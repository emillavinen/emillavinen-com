// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSyncRequest } from "@/lib/igout/auth";
import { cleanSnapshot, helsinkiDay, todaysQueue, type Snapshot } from "@/lib/igout/logic";

vi.mock("@/lib/igout/db", () => ({
  getSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  pendingTaps: vi.fn(),
  addTap: vi.fn(),
  removeTap: vi.fn(),
}));
const db = await import("@/lib/igout/db");
const actionsRoute = await import("@/app/api/igout/actions/route");
const snapshotRoute = await import("@/app/api/igout/snapshot/route");
const adminRoute = await import("@/app/api/admin/igout/route");

const SECRET = "test-secret-that-is-long-enough-123";
const DAY = 86400;
// Noon in Helsinki, so "today" doesn't depend on when the tests run.
const NOON = Date.UTC(2026, 9, 2, 9, 0, 0) / 1000;

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    generated_at: NOON - 3600,
    cap: 3,
    done_today: 0,
    wait_days: 14,
    cards: ["1", "2", "3", "4", "5"].map((id) => ({
      thread_id: id,
      username: `user${id}`,
      title: `User ${id}`,
      days_since_last_dm: 20,
      state: "unfollow_due",
    })),
    stats: {
      following: 818,
      chats: { prospect: 21 },
      prospects: 21,
      replied: 9,
      waiting: 9,
      unfollowed_7d: 0,
      last_import: NOON - DAY,
      last_sync: NOON - 3600,
    },
    ...overrides,
  };
}

function request(method: string, body?: unknown, token?: string) {
  return new Request("https://example.test/api", {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("sync secret", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isSyncRequest(request("GET", undefined, SECRET), SECRET)).toBe(true);
    expect(isSyncRequest(request("GET", undefined, SECRET + "x"), SECRET)).toBe(false);
    expect(isSyncRequest(request("GET"), SECRET)).toBe(false);
  });

  it("refuses everything when the secret is unset or too short", () => {
    expect(isSyncRequest(request("GET", undefined, "short"), "short")).toBe(false);
    expect(isSyncRequest(request("GET", undefined, ""), undefined)).toBe(false);
  });
});

describe("cleanSnapshot", () => {
  it("keeps only known fields, so no message text can be stored", () => {
    const dirty = snapshot();
    (dirty.cards[0] as Record<string, unknown>).last_message = "Hey! I help brands";
    (dirty as Record<string, unknown>).messages = ["secret"];
    const clean = cleanSnapshot(dirty)!;
    expect(JSON.stringify(clean)).not.toContain("help brands");
    expect(JSON.stringify(clean)).not.toContain("secret");
    expect(Object.keys(clean.cards[0]).sort()).toEqual(["days_since_last_dm", "state", "thread_id", "title", "username"]);
  });

  it("rejects malformed uploads", () => {
    expect(cleanSnapshot(null)).toBeNull();
    expect(cleanSnapshot({ cards: "x", stats: {} })).toBeNull();
    expect(cleanSnapshot(snapshot({ cards: [{ thread_id: "../x" } as never] }))).toBeNull();
  });
});

describe("todaysQueue", () => {
  it("hides tapped cards and counts Done taps against the daily cap", () => {
    const taps = [
      { id: 1, thread_id: "1", status: "done" as const, created_at: NOON - 60 },
      { id: 2, thread_id: "2", status: "skipped" as const, created_at: NOON - 60 },
    ];
    const q = todaysQueue(snapshot({ done_today: 1 }), taps, NOON);
    expect(q.cards.map((c) => c.thread_id)).toEqual(["3", "4", "5"]);
    expect(q.doneToday).toBe(2);
    expect(q.remaining).toBe(1);
  });

  it("ignores yesterday's counts", () => {
    const q = todaysQueue(
      snapshot({ generated_at: NOON - DAY, done_today: 3 }),
      [{ id: 1, thread_id: "1", status: "done", created_at: NOON - DAY }],
      NOON
    );
    expect(q.remaining).toBe(3);
  });

  it("uses Helsinki days", () => {
    // 22:30 UTC on Oct 1 is already Oct 2 in Helsinki.
    expect(helsinkiDay(Date.UTC(2026, 9, 1, 22, 30) / 1000)).toBe("2026-10-02");
  });
});

describe("routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.IGOUT_SYNC_SECRET = SECRET;
  });

  it("GET /api/igout/actions needs the secret", async () => {
    vi.mocked(db.pendingTaps).mockResolvedValue([{ id: 4, thread_id: "1", status: "done", created_at: NOON }]);
    expect((await actionsRoute.GET(request("GET"))).status).toBe(401);
    const res = await actionsRoute.GET(request("GET", undefined, SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ actions: [{ id: 4, thread_id: "1", status: "done", created_at: NOON }] });
  });

  it("POST /api/igout/snapshot stores a cleaned snapshot and the applied ids", async () => {
    expect((await snapshotRoute.POST(request("POST", { snapshot: snapshot(), applied: [] }, "wrong"))).status).toBe(401);
    expect((await snapshotRoute.POST(request("POST", { snapshot: snapshot() }, SECRET))).status).toBe(400);
    const res = await snapshotRoute.POST(request("POST", { snapshot: snapshot(), applied: [4, 5] }, SECRET));
    expect(res.status).toBe(200);
    expect(vi.mocked(db.saveSnapshot)).toHaveBeenCalledWith(expect.objectContaining({ cap: 3 }), [4, 5]);
  });

  it("POST /api/admin/igout validates the tap", async () => {
    vi.mocked(db.addTap).mockResolvedValue(9);
    expect((await adminRoute.POST(request("POST", { thread_id: "1", status: "maybe" }))).status).toBe(400);
    const res = await adminRoute.POST(request("POST", { thread_id: "1", status: "done" }));
    expect(await res.json()).toEqual({ id: 9 });
    expect(vi.mocked(db.addTap)).toHaveBeenCalledWith("1", "done");
  });

  it("DELETE /api/admin/igout undoes only unapplied taps", async () => {
    vi.mocked(db.removeTap).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await adminRoute.DELETE(request("DELETE", { id: 9 }))).status).toBe(200);
    expect((await adminRoute.DELETE(request("DELETE", { id: 9 }))).status).toBe(409);
  });
});
