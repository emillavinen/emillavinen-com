// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { runDispatch } from "@/lib/dispatch/runner";
import { createWork } from "@/lib/dispatch/works";
import { deliveries } from "@/lib/dispatch/db/schema";
import { cleanEnv, fakeNotifier, memoryBlob, routeFetch, sampleJpeg, seededRand, testDb } from "./helpers";

let restore: () => void = () => {};
afterEach(() => restore());

describe("runner smoke", () => {
  it("runs end to end against PGlite without SQL errors", async () => {
    restore = cleanEnv({ ARENA_TOKEN: "t", ARENA_CHANNEL: "c", DRY_RUN: "true" });
    const db = await testDb();
    const now = new Date("2026-10-01T09:00:00Z");
    const deps = {
      db,
      now,
      blob: memoryBlob(),
      rand: seededRand(),
      revalidate: () => {},
      fetch: routeFetch([]),
      sleep: async () => {},
      notifier: fakeNotifier(),
    };
    await runDispatch(deps, "test");
    await createWork(deps, { origin: "drop", title: "Smoke", images: [{ buffer: await sampleJpeg() }] }, { mode: "queue" });
    const report = await runDispatch({ ...deps, now: new Date(now.getTime() + 3 * 3600_000) }, "test");
    expect(report.errors).toEqual([]);
    const rows = await db.select().from(deliveries);
    expect(rows.find((r) => r.platform === "arena")?.status).toBe("skipped");
  });
});
