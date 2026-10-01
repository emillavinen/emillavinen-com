// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Platform } from "@/lib/dispatch/config";
import { getState, setStatus } from "@/lib/dispatch/credentials";
import type { Db } from "@/lib/dispatch/db/client";
import { alerts, deliveries, events, platformState, works } from "@/lib/dispatch/db/schema";
import { ADAPTERS } from "@/lib/dispatch/platforms";
import { PlatformError, type Adapter, type PostPayload, type PostResult } from "@/lib/dispatch/platforms/types";
import { indent, runDispatch, type RunnerDeps } from "@/lib/dispatch/runner";
import { isInWindow, DEFAULT_WINDOW } from "@/lib/dispatch/schedule";
import { logEvent, setSetting } from "@/lib/dispatch/store";
import { createWork, type QueueChoice } from "@/lib/dispatch/works";
import { cleanEnv, fakeNotifier, memoryBlob, routeFetch, sampleJpeg, seededRand, testDb } from "./helpers";

const HOUR = 3_600_000;
const MIN = 60_000;
// Thursday 1 Oct 2026, 12:00 in Helsinki.
const T0 = new Date("2026-10-01T09:00:00Z");

const ENV = {
  ARENA_TOKEN: "t",
  ARENA_CHANNEL: "c",
  X_API_KEY: "k",
  X_API_SECRET: "s",
  X_ACCESS_TOKEN: "t",
  X_ACCESS_TOKEN_SECRET: "ts",
  BSKY_HANDLE: "emil.bsky.social",
  BSKY_APP_PASSWORD: "p",
  DRY_RUN: "false",
};
const ENABLED: Platform[] = ["arena", "x", "bluesky"];

type Behaviour = (payload: PostPayload, n: number) => PostResult | Promise<PostResult>;

interface Fake extends Adapter {
  calls: PostPayload[];
  checks: number;
  behaviour: Behaviour;
  checkBehaviour: () => void;
}

function fake(platform: Platform): Fake {
  const real = ADAPTERS[platform];
  const f: Fake = {
    ...real,
    calls: [],
    checks: 0,
    behaviour: (_p, n) => ({ remoteId: `${platform}-${n}`, remoteUrl: `https://${platform}.test/${n}` }),
    checkBehaviour: () => {},
    configured: (state) => real.configured(state),
    async post(_ctx, payload) {
      f.calls.push(payload);
      return f.behaviour(payload, f.calls.length);
    },
    async check() {
      f.checks++;
      f.checkBehaviour();
      return { account: `@${platform}` };
    },
    maintain: undefined,
  };
  return f;
}

let db: Db;
let restore: () => void = () => {};
let fakes: Record<string, Fake>;
let notifier: ReturnType<typeof fakeNotifier>;
let rand: () => number;
let blob: ReturnType<typeof memoryBlob>;
let image: Buffer;

beforeEach(async () => {
  restore = cleanEnv(ENV);
  db = await testDb();
  fakes = Object.fromEntries((["arena", "x", "threads", "linkedin", "bluesky", "tumblr"] as Platform[]).map((p) => [p, fake(p)]));
  notifier = fakeNotifier();
  rand = seededRand(7);
  blob = memoryBlob();
  image ??= await sampleJpeg(400, 500);
});
afterEach(() => restore());

function deps(now: Date): RunnerDeps {
  return {
    db,
    now,
    blob,
    rand,
    revalidate: () => {},
    fetch: routeFetch([]),
    sleep: async () => {},
    notifier,
    adapters: fakes as unknown as RunnerDeps["adapters"],
  };
}

async function newWork(title: string, now = T0, queue: QueueChoice = { mode: "queue" }, extra: Record<string, unknown> = {}) {
  const { work } = await createWork(deps(now), { origin: "drop", title, images: [{ buffer: image }], ...extra }, queue);
  return work;
}

async function rowsFor(workId: string) {
  const rows = await db.select().from(deliveries).where(eq(deliveries.workId, workId));
  return Object.fromEntries(rows.map((r) => [r.platform, r]));
}

async function makeAllDue(at: Date) {
  await db.update(deliveries).set({ notBefore: at }).where(eq(deliveries.status, "pending"));
}

/** Runs until nothing is pending (or the guard trips), jumping the clock to each next due time. */
async function runUntilSettled(start: Date, guard = 60): Promise<Date> {
  let now = start;
  for (let i = 0; i < guard; i++) {
    await runDispatch(deps(now), "test");
    const pending = await db.select().from(deliveries).where(eq(deliveries.status, "pending"));
    if (pending.length === 0) {
      await runDispatch(deps(now), "test"); // one more for the summary
      return now;
    }
    const next = Math.min(...pending.map((p) => p.notBefore!.getTime()));
    now = new Date(Math.max(next, now.getTime() + MIN));
  }
  throw new Error("did not settle");
}

describe("queueing", () => {
  it("a new work gets a pending delivery per enabled platform, staggered in the window; the rest are skipped", async () => {
    const work = await newWork("Poster");
    const rows = await rowsFor(work.id);
    for (const p of ENABLED) {
      expect(rows[p].status).toBe("pending");
      expect(isInWindow(rows[p].notBefore!, DEFAULT_WINDOW)).toBe(true);
    }
    for (const p of ["threads", "linkedin", "tumblr"]) expect(rows[p]).toMatchObject({ status: "skipped", skipReason: "disabled" });
    const times = ENABLED.map((p) => rows[p].notBefore!.getTime()).sort();
    expect(times[0] - T0.getTime()).toBeGreaterThanOrEqual(10 * MIN);
    expect(times[0] - T0.getTime()).toBeLessThanOrEqual(30 * MIN);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(90 * MIN);
  });

  it("unticked platforms are skipped as deselected", async () => {
    const work = await newWork("Poster", T0, { mode: "queue", platforms: ["arena"] });
    const rows = await rowsFor(work.id);
    expect(rows.arena.status).toBe("pending");
    expect(rows.x).toMatchObject({ status: "skipped", skipReason: "deselected" });
  });
});

describe("posting", () => {
  it("handles at most 3 deliveries per call, never two for the same work", async () => {
    for (let i = 0; i < 4; i++) await newWork(`Work ${i}`);
    await makeAllDue(T0);
    const report = await runDispatch(deps(T0), "test");
    expect(report.handled).toHaveLength(3);
    const posted = await db.select().from(deliveries).where(eq(deliveries.status, "posted"));
    expect(posted).toHaveLength(3);
    expect(new Set(posted.map((p) => p.workId)).size).toBe(3);
    expect(posted.every((p) => p.remoteUrl && p.postedAt && p.text)).toBe(true);
  });

  it("two overlapping runs never post the same delivery twice", async () => {
    for (let i = 0; i < 3; i++) await newWork(`Work ${i}`);
    await makeAllDue(T0);
    await Promise.all([runDispatch(deps(T0), "test"), runDispatch(deps(T0), "test"), runDispatch(deps(T0), "test")]);
    const payloads = Object.values(fakes).flatMap((f) => f.calls.map((c) => `${f.platform}:${c.work.id}`));
    expect(new Set(payloads).size).toBe(payloads.length);
  });

  it("the post carries the UTM link to the work page", async () => {
    await newWork("Poster", T0, { mode: "queue", platforms: ["bluesky"] });
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    expect(fakes.bluesky.calls[0].link).toBe("https://emillavinen.com/work/poster?utm_source=bluesky&utm_medium=social&utm_campaign=dispatch");
    expect(fakes.bluesky.calls[0].text).toContain(fakes.bluesky.calls[0].link);
  });

  it("outside the posting window nothing posts; it moves to the next opening", async () => {
    const night = new Date("2026-10-01T20:30:00Z"); // 23:30 Helsinki
    const work = await newWork("Late", T0, { mode: "queue", platforms: ["arena"] });
    await makeAllDue(night);
    await runDispatch(deps(night), "test");
    const row = (await rowsFor(work.id)).arena;
    expect(row.status).toBe("pending");
    expect(row.notBefore!.getTime()).toBeGreaterThanOrEqual(new Date("2026-10-02T06:00:00Z").getTime());
    expect(row.notBefore!.getTime()).toBeLessThanOrEqual(new Date("2026-10-02T06:30:00Z").getTime());
    expect(fakes.arena.calls).toHaveLength(0);
  });

  it("respects the daily cap and moves the rest to tomorrow", async () => {
    process.env.CAP_ARENA = "1";
    const a = await newWork("A", T0, { mode: "queue", platforms: ["arena"] });
    const b = await newWork("B", T0, { mode: "queue", platforms: ["arena"] });
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    const later = new Date(T0.getTime() + HOUR);
    await runDispatch(deps(later), "test");
    const statuses = [(await rowsFor(a.id)).arena, (await rowsFor(b.id)).arena];
    expect(statuses.filter((s) => s.status === "posted")).toHaveLength(1);
    const waiting = statuses.find((s) => s.status === "pending")!;
    expect(waiting.notBefore!.getTime()).toBeGreaterThanOrEqual(new Date("2026-10-02T06:00:00Z").getTime());
  });

  it("hidden works are not dispatched", async () => {
    const work = await newWork("Hidden", T0, { mode: "queue", platforms: ["arena"] });
    await db.update(works).set({ visibleOnSite: false }).where(eq(works.id, work.id));
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    expect((await rowsFor(work.id)).arena).toMatchObject({ status: "skipped", skipReason: "hidden" });
  });

  it("a platform that lost its credentials skips instead of erroring", async () => {
    const work = await newWork("Poster", T0, { mode: "queue", platforms: ["arena"] });
    delete process.env.ARENA_TOKEN;
    await makeAllDue(T0);
    const report = await runDispatch(deps(T0), "test");
    expect(report.errors).toEqual([]);
    expect((await rowsFor(work.id)).arena).toMatchObject({ status: "skipped", skipReason: "disabled" });
    expect((await getState(db, "arena"))?.status).toBe("disabled");
  });
});

describe("failures", () => {
  it("transient errors retry after 30 min, 2 h, 8 h, then fail", async () => {
    fakes.arena.behaviour = () => {
      throw new PlatformError("transient", "502 from Are.na");
    };
    const work = await newWork("Flaky", T0, { mode: "queue", platforms: ["arena"] });
    await makeAllDue(T0);
    const gaps: number[] = [];
    let now = T0;
    for (let i = 0; i < 4; i++) {
      await runDispatch(deps(now), "test");
      const row = (await rowsFor(work.id)).arena;
      if (row.status === "pending") {
        gaps.push(Math.round((row.notBefore!.getTime() - now.getTime()) / MIN));
        now = row.notBefore!;
      }
    }
    const row = (await rowsFor(work.id)).arena;
    expect(row).toMatchObject({ status: "failed", attempts: 4, lastError: "502 from Are.na" });
    expect(gaps.slice(0, 2)).toEqual([30, 120]);
    expect(gaps[2]).toBeGreaterThanOrEqual(480); // 8 h, pushed into the window if needed
    expect(fakes.arena.calls).toHaveLength(4);
  });

  it("429 reschedules at the reset time and is not counted as an attempt", async () => {
    const reset = new Date(T0.getTime() + 47 * MIN);
    fakes.x.behaviour = () => {
      throw new PlatformError("rate_limited", "429", { retryAt: reset });
    };
    const work = await newWork("Busy", T0, { mode: "queue", platforms: ["x"] });
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    expect((await rowsFor(work.id)).x).toMatchObject({ status: "pending", attempts: 0, notBefore: reset });
  });

  it("auth errors fail the delivery, pause the platform with one alert, and resume by themselves", async () => {
    fakes.x.behaviour = () => {
      throw new PlatformError("auth", "401 token revoked");
    };
    fakes.x.checkBehaviour = () => {
      throw new PlatformError("auth", "still revoked");
    };
    const first = await newWork("First", T0, { mode: "queue", platforms: ["x"] });
    const second = await newWork("Second", T0, { mode: "queue", platforms: ["x"] });
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    await runDispatch(deps(new Date(T0.getTime() + HOUR)), "test");

    const rows = [(await rowsFor(first.id)).x, (await rowsFor(second.id)).x];
    expect(rows.filter((r) => r.status === "failed")).toHaveLength(1);
    expect(rows.filter((r) => r.status === "pending")).toHaveLength(1); // paused, not attempted
    expect(fakes.x.calls).toHaveLength(1);
    expect((await getState(db, "x"))?.status).toBe("needs_attention");
    expect(notifier.messages.filter((m) => m.startsWith("X needs attention"))).toHaveLength(1);

    // Three hours later the automatic re-check passes: the queue resumes.
    fakes.x.checkBehaviour = () => {};
    fakes.x.behaviour = (_p, n) => ({ remoteId: `x-${n}`, remoteUrl: null });
    const later = new Date(T0.getTime() + 3 * HOUR + 5 * MIN);
    await runDispatch(deps(later), "test");
    expect((await getState(db, "x"))?.status).toBe("ok");
    expect(notifier.messages.some((m) => m.includes("checks out again"))).toBe(true);
    expect(rows.find((r) => r.status === "pending") && (await rowsFor(rows.find((r) => r.status === "pending")!.workId)).x.status).toBe("posted");
  });

  it("out of X credits says to top up", async () => {
    fakes.x.behaviour = () => {
      throw new PlatformError("credits", "402");
    };
    await newWork("Poster", T0, { mode: "queue", platforms: ["x"] });
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    expect(notifier.messages.find((m) => m.startsWith("X needs attention"))).toMatch(/top up X credits/);
  });

  it("rejected fails without retry and without pausing the platform", async () => {
    fakes.arena.behaviour = () => {
      throw new PlatformError("rejected", "422 bad image");
    };
    const work = await newWork("Poster", T0, { mode: "queue", platforms: ["arena"] });
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    expect((await rowsFor(work.id)).arena.status).toBe("failed");
    expect((await getState(db, "arena"))?.status).toBe("ok");
  });

  it("an ambiguous publish becomes unknown, alerts, and is never retried", async () => {
    fakes.bluesky.behaviour = () => {
      throw new PlatformError("ambiguous", "no response from createRecord");
    };
    const work = await newWork("Poster", T0, { mode: "queue", platforms: ["bluesky"] });
    await makeAllDue(T0);
    await runDispatch(deps(T0), "test");
    for (let h = 1; h <= 10; h++) await runDispatch(deps(new Date(T0.getTime() + h * HOUR)), "test");
    expect((await rowsFor(work.id)).bluesky.status).toBe("unknown");
    expect(fakes.bluesky.calls).toHaveLength(1);
    expect(notifier.messages.filter((m) => m.startsWith("Bluesky — \"Poster\" may or may not have posted"))).toHaveLength(1);
  });

  it("a delivery stuck in posting for 15 minutes becomes unknown (the run died mid-post)", async () => {
    const work = await newWork("Poster", T0, { mode: "queue", platforms: ["arena"] });
    await db.update(deliveries).set({ status: "posting", claimedAt: T0 }).where(eq(deliveries.workId, work.id));
    await runDispatch(deps(new Date(T0.getTime() + 10 * MIN)), "test");
    expect((await rowsFor(work.id)).arena.status).toBe("posting");
    await runDispatch(deps(new Date(T0.getTime() + 16 * MIN)), "test");
    expect((await rowsFor(work.id)).arena.status).toBe("unknown");
    expect(notifier.messages.some((m) => m.includes("may or may not have posted"))).toBe(true);
    expect(fakes.arena.calls).toHaveLength(0);
  });
});

describe("dry run, kill switch, settings", () => {
  it("dry run does everything but the platform call, and the summary shows the text", async () => {
    process.env.DRY_RUN = "true";
    const work = await newWork("Poster", T0, { mode: "queue" }, { caption: "Three formats." });
    await runUntilSettled(T0);
    const rows = await rowsFor(work.id);
    for (const p of ENABLED) expect(rows[p]).toMatchObject({ status: "skipped", skipReason: "dry_run" });
    expect(Object.values(fakes).every((f) => f.calls.length === 0)).toBe(true);
    const summary = notifier.messages.find((m) => m.startsWith("Poster"))!;
    expect(summary).toContain("dry run, would post:");
    expect(summary).toContain(indent(rows.x.text!));
    expect(summary).toContain("Three formats.");
  });

  it("DISPATCH_ENABLED=false: the runner does nothing", async () => {
    process.env.DISPATCH_ENABLED = "false";
    await newWork("Poster");
    await makeAllDue(T0);
    const report = await runDispatch(deps(T0), "test");
    expect(report.skipped).toBe("disabled");
    expect(await db.select().from(events)).toHaveLength(0);
    expect((await db.select().from(deliveries).where(eq(deliveries.status, "pending"))).length).toBe(3);
  });

  it("admin settings override the env without a redeploy", async () => {
    await setSetting(db, "enabled", false, T0);
    expect((await runDispatch(deps(T0), "test")).skipped).toBe("disabled");
    await setSetting(db, "enabled", null, T0);
    await setSetting(db, "dry_run", true, T0);
    expect((await runDispatch(deps(T0), "test")).dryRun).toBe(true);
  });
});

describe("summaries and alerts", () => {
  it("one summary per work once every delivery settles, with links and reasons", async () => {
    fakes.x.behaviour = () => {
      throw new PlatformError("rejected", "422 text too long");
    };
    const work = await newWork("Poster");
    const settled = await runUntilSettled(T0);
    const summaries = notifier.messages.filter((m) => m.startsWith("Poster\n"));
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toContain("Are.na: https://arena.test/1");
    expect(summaries[0]).toContain("X: failed — 422 text too long");
    expect(summaries[0]).toContain("Threads: skipped (not connected)");
    expect(summaries[0]).toContain(`https://emillavinen.com/work/${work.slug}`);
    await runDispatch(deps(new Date(settled.getTime() + HOUR)), "test");
    expect(notifier.messages.filter((m) => m.startsWith("Poster\n"))).toHaveLength(1);
  });

  it("an open alert repeats once a day, not every run", async () => {
    fakes.x.behaviour = () => {
      throw new PlatformError("auth", "revoked");
    };
    fakes.x.checkBehaviour = () => {
      throw new PlatformError("auth", "revoked");
    };
    await newWork("Poster", T0, { mode: "queue", platforms: ["x"] });
    await makeAllDue(T0);
    for (let h = 0; h < 20; h++) await runDispatch(deps(new Date(T0.getTime() + h * HOUR)), "test");
    const count = () => notifier.messages.filter((m) => m.includes("X needs attention")).length;
    expect(count()).toBe(1);
    await runDispatch(deps(new Date(T0.getTime() + 25 * HOUR)), "test");
    expect(count()).toBe(2);
    expect(notifier.messages.filter((m) => m.startsWith("Still open:"))).toHaveLength(1);
  });

  it("the daily Vercel run alerts when the hourly GitHub trigger has gone quiet", async () => {
    await runDispatch(deps(T0), "vercel-cron");
    expect(notifier.messages.some((m) => m.includes("hourly GitHub trigger has not run yet"))).toBe(true);
    const n = notifier.messages.length;
    await runDispatch(deps(new Date(T0.getTime() + HOUR)), "github");
    expect(notifier.messages.at(-1)).toMatch(/running again/);
    await runDispatch(deps(new Date(T0.getTime() + 3 * HOUR)), "vercel-cron");
    expect(notifier.messages.length).toBe(n + 1);
    const [open] = await db.select().from(alerts).where(eq(alerts.key, "trigger"));
    expect(open.active).toBe(false);
    await runDispatch(deps(new Date(T0.getTime() + 8 * HOUR)), "vercel-cron");
    expect(notifier.messages.at(-1)).toMatch(/has not run since/);
  });

  it("prunes events older than 90 days", async () => {
    await logEvent(db, new Date(T0.getTime() - 91 * 24 * HOUR), { type: "old" });
    await logEvent(db, new Date(T0.getTime() - 89 * 24 * HOUR), { type: "recent" });
    await runDispatch(deps(T0), "test");
    const types = (await db.select().from(events)).map((e) => e.type);
    expect(types).not.toContain("old");
    expect(types).toContain("recent");
  });
});

describe("backlog", () => {
  it("held works are never dispatched on their own", async () => {
    const work = await newWork("Old", T0, { mode: "held" });
    const rows = await rowsFor(work.id);
    expect(ENABLED.every((p) => rows[p].status === "held")).toBe(true);
    for (let h = 0; h < 30; h++) await runDispatch(deps(new Date(T0.getTime() + h * HOUR)), "test");
    expect(Object.values(fakes).every((f) => f.calls.length === 0)).toBe(true);
    expect(notifier.messages.filter((m) => m.startsWith("Old"))).toHaveLength(0);
  });

  it("enabling a platform later gives existing works held deliveries, never pending", async () => {
    await runDispatch(deps(T0), "test");
    const queued = await newWork("Queued");
    const old = await newWork("Old", T0, { mode: "held" });
    expect((await rowsFor(queued.id)).tumblr).toMatchObject({ status: "skipped", skipReason: "disabled" });
    expect((await rowsFor(old.id)).tumblr).toBeUndefined();

    Object.assign(process.env, { TUMBLR_CONSUMER_KEY: "a", TUMBLR_CONSUMER_SECRET: "b", TUMBLR_TOKEN: "c", TUMBLR_TOKEN_SECRET: "d", TUMBLR_BLOG: "e" });
    await runDispatch(deps(new Date(T0.getTime() + HOUR)), "test");
    expect((await rowsFor(queued.id)).tumblr.status).toBe("held");
    expect((await rowsFor(old.id)).tumblr.status).toBe("held");
    expect(await db.select().from(deliveries).where(and(eq(deliveries.platform, "tumblr"), eq(deliveries.status, "pending")))).toHaveLength(0);
  });

  it("a work written where a platform was not configured (the local import) gets its held row on the next run", async () => {
    await runDispatch(deps(T0), "test");
    const saved = process.env.ARENA_TOKEN;
    delete process.env.ARENA_TOKEN; // the import runs without the site's env
    const imported = await newWork("Imported", T0, { mode: "held" });
    expect((await rowsFor(imported.id)).arena).toBeUndefined();
    process.env.ARENA_TOKEN = saved;
    await runDispatch(deps(new Date(T0.getTime() + HOUR)), "test");
    expect((await rowsFor(imported.id)).arena.status).toBe("held");
  });

  it("BACKLOG_DRIP_PER_DAY moves held works into the queue, oldest first, up to the daily number", async () => {
    process.env.BACKLOG_DRIP_PER_DAY = "2";
    const oldest = await newWork("Oldest", T0, { mode: "held" }, { createdAt: new Date("2020-01-01T00:00:00Z") });
    const middle = await newWork("Middle", T0, { mode: "held" }, { createdAt: new Date("2021-01-01T00:00:00Z") });
    const newest = await newWork("Newest", T0, { mode: "held" }, { createdAt: new Date("2022-01-01T00:00:00Z") });
    const pendingWorks = async () => new Set((await db.select().from(deliveries).where(eq(deliveries.status, "pending"))).map((d) => d.workId));

    await runDispatch(deps(T0), "test");
    expect(await pendingWorks()).toEqual(new Set([oldest.id]));
    await runDispatch(deps(new Date(T0.getTime() + HOUR)), "test");
    expect((await pendingWorks()).has(middle.id)).toBe(true);
    await runDispatch(deps(new Date(T0.getTime() + 2 * HOUR)), "test");
    expect((await pendingWorks()).has(newest.id)).toBe(false); // today's two are used
    await runDispatch(deps(new Date(T0.getTime() + 24 * HOUR)), "test");
    const all = await db.select().from(deliveries).where(eq(deliveries.workId, newest.id));
    expect(all.some((d) => d.status === "pending" || d.status === "posted")).toBe(true);
  });

  it("drip is off by default", async () => {
    await newWork("Old", T0, { mode: "held" });
    await runDispatch(deps(T0), "test");
    expect(await db.select().from(deliveries).where(eq(deliveries.status, "pending"))).toHaveLength(0);
  });
});

describe("platform state", () => {
  it("records disabled platforms with what they are missing", async () => {
    await runDispatch(deps(T0), "test");
    const rows = Object.fromEntries((await db.select().from(platformState)).map((r) => [r.platform, r]));
    expect(rows.arena.status).toBe("ok");
    expect(rows.threads.status).toBe("disabled");
    expect(rows.threads.note).toMatch(/THREADS_APP_ID/);
  });

  it("does not re-check a paused platform more than every three hours", async () => {
    await runDispatch(deps(T0), "test");
    await setStatus(db, "x", T0, "needs_attention", "revoked", { checked: true });
    fakes.x.checkBehaviour = () => {
      throw new PlatformError("auth", "revoked");
    };
    for (let m = 10; m < 170; m += 30) await runDispatch(deps(new Date(T0.getTime() + m * MIN)), "test");
    expect(fakes.x.checks).toBe(0);
    await runDispatch(deps(new Date(T0.getTime() + 181 * MIN)), "test");
    expect(fakes.x.checks).toBe(1);
  });
});
