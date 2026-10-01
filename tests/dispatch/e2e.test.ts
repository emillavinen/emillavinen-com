// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/dispatch/db/client";
import { alerts, deliveries, feedItems, works } from "@/lib/dispatch/db/schema";
import { indent, runDispatch, type RunnerDeps } from "@/lib/dispatch/runner";
import { createWork } from "@/lib/dispatch/works";
import { cleanEnv, fakeNotifier, memoryBlob, routeFetch, sampleJpeg, seededRand, testDb } from "./helpers";

/**
 * End to end, dry run, mocked clock: Pinterest board → baseline → a new pin
 * → the runner called until everything settles → every delivery state and
 * the summary checked. Only HTTP is faked; the store is real Postgres
 * (PGlite) with the committed migrations.
 */

const BOARD = "https://www.pinterest.com/emillavinen/feargod-2010";
const OTHER = "https://www.pinterest.com/emillavinen/grandeur";
const fixture = readFileSync(path.join(__dirname, "fixtures/pinterest-board.rss"), "utf8");
const HOUR = 3_600_000;
const T0 = new Date("2026-10-01T07:00:00Z"); // 10:00 Helsinki

const NEW_PIN = `
        <item>
            <title>Soznanie Fest — poster</title>
            <link>https://www.pinterest.com/pin/693906255199999999/</link>
            <description>&lt;a href=&quot;https://www.pinterest.com/pin/693906255199999999/&quot;&gt;&lt;img src=&quot;https://i.pinimg.com/236x/aa/bb/cc/newpin.jpg&quot;&gt;&lt;/a&gt;Festival identity, &amp;#8220;print and motion&amp;#8221;.</description>
            <pubDate>Thu, 01 Oct 2026 07:30:00 GMT</pubDate>
            <guid>https://www.pinterest.com/pin/693906255199999999/</guid>
        </item>`;
const withNewPin = fixture.replace("<item>", `${NEW_PIN.trim()}\n        <item>`);

let db: Db;
let restore: () => void = () => {};
let notifier: ReturnType<typeof fakeNotifier>;
let jpeg: Buffer;
let feeds: Record<string, () => Response>;

beforeAll(async () => {
  jpeg = await sampleJpeg(500, 700, "#303030");
});

beforeEach(async () => {
  restore = cleanEnv({
    ARENA_TOKEN: "t",
    ARENA_CHANNEL: "emillavinen",
    X_API_KEY: "k",
    X_API_SECRET: "s",
    X_ACCESS_TOKEN: "t",
    X_ACCESS_TOKEN_SECRET: "ts",
    BSKY_HANDLE: "emil.bsky.social",
    BSKY_APP_PASSWORD: "p",
    PINTEREST_BOARDS: `${BOARD}/, ${OTHER}`,
    // DRY_RUN unset: the default is dry run.
  });
  db = await testDb();
  notifier = fakeNotifier();
  feeds = {
    [`${BOARD}.rss`]: () => new Response(fixture, { headers: { "Content-Type": "text/xml" } }),
    [`${OTHER}.rss`]: () => new Response("<rss version=\"2.0\"><channel><title>Grandeur</title></channel></rss>", { headers: { "Content-Type": "text/xml" } }),
  };
});
afterEach(() => restore());

const fetchMock = () =>
  routeFetch([
    [/\.rss$/, (url) => (feeds[url] ?? (() => new Response("not found", { status: 404 })))()],
    // Full size is not always there: fall back to 1200x.
    [/i\.pinimg\.com\/originals\/aa\//, () => new Response("forbidden", { status: 403 })],
    [/i\.pinimg\.com\//, () => new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg" } })],
  ]);

function deps(now: Date, fetch = fetchMock()): RunnerDeps & { fetch: ReturnType<typeof routeFetch> } {
  return {
    db,
    now,
    blob: memoryBlob(),
    rand: seededRand(11),
    revalidate: () => {},
    fetch,
    sleep: async () => {},
    notifier,
    budgetMs: 120_000,
  };
}

async function settle(start: Date): Promise<Date> {
  let now = start;
  for (let i = 0; i < 40; i++) {
    await runDispatch(deps(now), "test");
    const pending = await db.select().from(deliveries).where(eq(deliveries.status, "pending"));
    if (pending.length === 0) return now;
    now = new Date(Math.max(Math.min(...pending.map((p) => p.notBefore!.getTime())), now.getTime() + 60_000));
  }
  throw new Error("did not settle");
}

describe("DISPATCH end to end (dry run, mocked clock)", () => {
  it("baseline pins show on the site but never go out; a new pin goes out (in dry run) and is summarised", async () => {
    // First read of the board: everything in it is baseline.
    const first = await runDispatch(deps(T0), "test");
    expect(first.errors).toEqual([]);
    expect(first.dryRun).toBe(true);
    const baseline = await db.select().from(works);
    expect(baseline).toHaveLength(25);
    expect(baseline.every((w) => w.origin === "pinterest" && w.visibleOnSite && w.queuedAt === null)).toBe(true);
    const held = await db.select().from(deliveries);
    expect(held.every((d) => d.status === "held")).toBe(true);
    expect(held).toHaveLength(25 * 3);
    // Created dates come from the pins' pubDate.
    expect(baseline.find((w) => w.sourceId === "693906255131793877")?.createdAt.toISOString()).toBe("2026-06-11T09:20:05.000Z");

    // An hour later a new pin appears.
    feeds[`${BOARD}.rss`] = () => new Response(withNewPin, { headers: { "Content-Type": "text/xml" } });
    const t1 = new Date(T0.getTime() + HOUR);
    const second = await runDispatch(deps(t1), "test");
    expect(second.newPins).toBe(1);
    const [fresh] = await db.select().from(works).where(eq(works.sourceId, "693906255199999999"));
    expect(fresh).toMatchObject({ title: "Soznanie Fest — poster", caption: "Festival identity, “print and motion”.", slug: "soznanie-fest-poster" });
    expect(fresh.queuedAt).not.toBeNull();
    const pending = await db.select().from(deliveries).where(eq(deliveries.workId, fresh.id));
    expect(pending.filter((d) => d.status === "pending").map((d) => d.platform).sort()).toEqual(["arena", "bluesky", "x"]);

    // Run until everything settles.
    await settle(t1);
    const settled = Object.fromEntries((await db.select().from(deliveries).where(eq(deliveries.workId, fresh.id))).map((d) => [d.platform, d]));
    for (const p of ["arena", "x", "bluesky"]) expect(settled[p]).toMatchObject({ status: "skipped", skipReason: "dry_run" });
    for (const p of ["threads", "linkedin", "tumblr"]) expect(settled[p]).toMatchObject({ status: "skipped", skipReason: "disabled" });
    expect(settled.x.text).toBe("Soznanie Fest — poster\n\nFestival identity, “print and motion”.");
    expect(settled.bluesky.text).toContain("utm_source=bluesky&utm_medium=social&utm_campaign=dispatch");

    // Exactly one summary, for the new work only, with the exact texts.
    const summaries = notifier.messages.filter((m) => !m.startsWith("The hourly"));
    expect(summaries).toHaveLength(1);
    expect(summaries[0].split("\n")[0]).toBe("Soznanie Fest — poster");
    expect(summaries[0]).toContain(`X: dry run, would post:\n${indent(settled.x.text!)}`);
    expect(summaries[0]).toContain(`Bluesky: dry run, would post:\n${indent(settled.bluesky.text!)}`);
    expect(summaries[0]).toContain("Threads: skipped (not connected)");
    expect(summaries[0]).toContain("https://emillavinen.com/work/soznanie-fest-poster");

    // Baseline works stayed held through all of it.
    const stillHeld = await db.select().from(deliveries).where(eq(deliveries.status, "held"));
    expect(stillHeld).toHaveLength(75);
  }, 120_000);

  it("a pin seen again, or on another board, or already imported, never becomes a second work", async () => {
    await createWork(
      deps(T0),
      { origin: "import", sourceId: "693906255199999999", title: "Imported earlier", images: [{ buffer: jpeg }] },
      { mode: "held" }
    );
    await runDispatch(deps(T0), "test");
    feeds[`${BOARD}.rss`] = () => new Response(withNewPin, { headers: { "Content-Type": "text/xml" } });
    feeds[`${OTHER}.rss`] = () =>
      new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Grandeur</title>${NEW_PIN}</channel></rss>`, { headers: { "Content-Type": "text/xml" } });
    await runDispatch(deps(new Date(T0.getTime() + HOUR)), "test");
    await runDispatch(deps(new Date(T0.getTime() + 2 * HOUR)), "test");
    const matching = await db.select().from(works).where(eq(works.sourceId, "693906255199999999"));
    expect(matching).toHaveLength(1);
    expect(matching[0].origin).toBe("import");
    const [item] = await db.select().from(feedItems).where(eq(feedItems.pinId, "693906255199999999"));
    expect(item.workId).toBe(matching[0].id);
    expect(await db.select().from(deliveries).where(eq(deliveries.status, "pending"))).toHaveLength(0);
  }, 120_000);

  it("a broken feed alerts once, retries every run, and does not stop the other board", async () => {
    feeds[`${OTHER}.rss`] = () => new Response("<html>blocked</html>", { status: 200, headers: { "Content-Type": "text/html" } });
    for (let h = 0; h < 5; h++) await runDispatch(deps(new Date(T0.getTime() + h * HOUR)), "test");
    const broken = notifier.messages.filter((m) => m.startsWith("Pinterest feed broke"));
    expect(broken).toHaveLength(1);
    expect(broken[0]).toContain(OTHER);
    expect(await db.select().from(works)).toHaveLength(25); // the good board still ingested
    feeds[`${OTHER}.rss`] = () => new Response("<rss version=\"2.0\"><channel><title>Grandeur</title></channel></rss>");
    await runDispatch(deps(new Date(T0.getTime() + 6 * HOUR)), "test");
    expect(notifier.messages.at(-1)).toBe(`Pinterest feed works again: ${OTHER}`);
    const [row] = await db.select().from(alerts).where(eq(alerts.key, `feed:${OTHER}`));
    expect(row.active).toBe(false);
  }, 120_000);

  it("the first successful read is the baseline even if earlier reads failed", async () => {
    feeds[`${BOARD}.rss`] = () => new Response("oops", { status: 500 });
    await runDispatch(deps(T0), "test");
    expect(await db.select().from(works)).toHaveLength(0);
    feeds[`${BOARD}.rss`] = () => new Response(withNewPin);
    await runDispatch(deps(new Date(T0.getTime() + HOUR)), "test");
    expect(await db.select().from(works)).toHaveLength(26);
    expect(await db.select().from(deliveries).where(eq(deliveries.status, "pending"))).toHaveLength(0);
  }, 120_000);
});
