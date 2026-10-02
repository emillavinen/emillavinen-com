import { describe, expect, it } from "vitest";
import {
  backoffDelayMs,
  dayKey,
  dayRange,
  DEFAULT_WINDOW,
  fitToWindow,
  isInWindow,
  minutesOfDay,
  nextDayOpening,
  nextOpening,
  parseWindow,
  planDeliveries,
  shuffle,
  zonedTimeToUtc,
} from "@/lib/dispatch/schedule";
import { seededRand } from "./helpers";

const MIN = 60_000;
const at = (iso: string) => new Date(iso);

describe("posting window", () => {
  it("parses POSTING_WINDOW and falls back on nonsense", () => {
    expect(parseWindow("09:00-22:00")).toEqual({ start: 540, end: 1320 });
    expect(parseWindow(" 7:30 - 23:15 ")).toEqual({ start: 450, end: 1395 });
    expect(parseWindow(undefined)).toEqual(DEFAULT_WINDOW);
    expect(parseWindow("22:00-09:00")).toEqual(DEFAULT_WINDOW);
    expect(parseWindow("banana")).toEqual(DEFAULT_WINDOW);
  });

  it("judges Helsinki local time, stored in UTC (summer, UTC+3)", () => {
    expect(isInWindow(at("2026-10-01T06:00:00Z"), DEFAULT_WINDOW)).toBe(true); // 09:00
    expect(isInWindow(at("2026-10-01T05:59:00Z"), DEFAULT_WINDOW)).toBe(false); // 08:59
    expect(isInWindow(at("2026-10-01T18:59:00Z"), DEFAULT_WINDOW)).toBe(true); // 21:59
    expect(isInWindow(at("2026-10-01T19:00:00Z"), DEFAULT_WINDOW)).toBe(false); // 22:00
  });

  it("judges Helsinki local time in winter (UTC+2)", () => {
    expect(minutesOfDay(at("2026-12-01T07:00:00Z"))).toBe(9 * 60);
    expect(isInWindow(at("2026-12-01T06:59:00Z"), DEFAULT_WINDOW)).toBe(false);
    expect(isInWindow(at("2026-12-01T07:00:00Z"), DEFAULT_WINDOW)).toBe(true);
  });

  it("finds the next opening: later today before the window, tomorrow after it", () => {
    expect(nextOpening(at("2026-10-01T03:00:00Z"), DEFAULT_WINDOW).toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(nextOpening(at("2026-10-01T20:00:00Z"), DEFAULT_WINDOW).toISOString()).toBe("2026-10-02T06:00:00.000Z");
    // 00:30 Helsinki is already the next local day: opening is that morning.
    expect(nextOpening(at("2026-10-01T21:30:00Z"), DEFAULT_WINDOW).toISOString()).toBe("2026-10-02T06:00:00.000Z");
  });

  it("handles the October DST switch (2026-10-25)", () => {
    // 22:00 EET on the 25th → next opening is 09:00 EET on the 26th = 07:00Z.
    expect(nextOpening(at("2026-10-25T20:00:00Z"), DEFAULT_WINDOW).toISOString()).toBe("2026-10-26T07:00:00.000Z");
    const { start, end } = dayRange(at("2026-10-25T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-24T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T22:00:00.000Z");
    expect(zonedTimeToUtc(2026, 3, 29, 9, 0).toISOString()).toBe("2026-03-29T06:00:00.000Z"); // spring forward day
  });

  it("uses the Helsinki calendar day", () => {
    expect(dayKey(at("2026-10-01T21:30:00Z"))).toBe("2026-10-02");
    expect(dayKey(at("2026-10-01T20:59:00Z"))).toBe("2026-10-01");
    expect(nextDayOpening(at("2026-10-01T10:00:00Z"), DEFAULT_WINDOW).toISOString()).toBe("2026-10-02T06:00:00.000Z");
  });

  it("leaves in-window times alone and moves others to the opening plus 0–30 min", () => {
    const inside = at("2026-10-01T10:00:00Z");
    expect(fitToWindow(inside, DEFAULT_WINDOW, () => 0.5)).toBe(inside);
    const night = at("2026-10-01T23:00:00Z");
    expect(fitToWindow(night, DEFAULT_WINDOW, () => 0).toISOString()).toBe("2026-10-02T06:00:00.000Z");
    expect(fitToWindow(night, DEFAULT_WINDOW, () => 1).toISOString()).toBe("2026-10-02T06:30:00.000Z");
  });
});

describe("staggered plan", () => {
  const platforms = ["arena", "x", "threads", "linkedin", "bluesky", "tumblr"] as const;

  it("first at +10–30 min, each next 90–150 min later, shuffled, all in the window", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const now = at("2026-10-01T06:30:00Z"); // 09:30 Helsinki
      const plan = planDeliveries(platforms, now, DEFAULT_WINDOW, seededRand(seed));
      expect(new Set(plan.map((p) => p.platform)).size).toBe(platforms.length);
      for (const p of plan) expect(isInWindow(p.notBefore, DEFAULT_WINDOW)).toBe(true);
      const first = plan[0].notBefore.getTime() - now.getTime();
      expect(first).toBeGreaterThanOrEqual(10 * MIN);
      expect(first).toBeLessThanOrEqual(30 * MIN);
      for (let i = 1; i < plan.length; i++) {
        const gap = plan[i].notBefore.getTime() - plan[i - 1].notBefore.getTime();
        // Either a normal 90–150 min gap, or pushed to the next morning.
        if (plan[i].notBefore.getUTCDate() === plan[i - 1].notBefore.getUTCDate()) {
          expect(gap).toBeGreaterThanOrEqual(90 * MIN);
          expect(gap).toBeLessThanOrEqual(150 * MIN);
        } else {
          expect(gap).toBeGreaterThan(90 * MIN);
        }
      }
    }
  });

  it("orders differently for different random draws", () => {
    const orders = new Set(
      Array.from({ length: 10 }, (_, i) => planDeliveries(platforms, at("2026-10-01T06:30:00Z"), DEFAULT_WINDOW, seededRand(i + 1)).map((p) => p.platform).join())
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("queued late at night: everything lands inside tomorrow's window", () => {
    const plan = planDeliveries(platforms, at("2026-10-01T18:55:00Z"), DEFAULT_WINDOW, seededRand(3)); // 21:55
    for (const p of plan) expect(isInWindow(p.notBefore, DEFAULT_WINDOW)).toBe(true);
    expect(plan[plan.length - 1].notBefore.getTime()).toBeGreaterThan(at("2026-10-02T06:00:00Z").getTime());
  });

  it("shuffle keeps every item", () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRand(9)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("backoff", () => {
  it("retries transient failures after 30 min, 2 h, 8 h, then gives up", () => {
    expect(backoffDelayMs(1)).toBe(30 * MIN);
    expect(backoffDelayMs(2)).toBe(120 * MIN);
    expect(backoffDelayMs(3)).toBe(480 * MIN);
    expect(backoffDelayMs(4)).toBeNull();
    expect(backoffDelayMs(0)).toBeNull();
  });
});
