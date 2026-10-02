import { env, TIMEZONE, type Platform } from "./config";

/**
 * Scheduling maths. Pure functions of an injected clock and random source,
 * so every rule here is unit-tested. Times are stored in UTC and reasoned
 * about in Helsinki time.
 */

export type Rand = () => number;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export interface PostingWindow {
  /** Minutes after local midnight the window opens. */
  start: number;
  /** Minutes after local midnight the window closes (exclusive). */
  end: number;
}

export const DEFAULT_WINDOW: PostingWindow = { start: 9 * 60, end: 22 * 60 };

/** Parses POSTING_WINDOW ("09:00-22:00"). Anything unreadable falls back to the default. */
export function parseWindow(spec: string | undefined = env("POSTING_WINDOW")): PostingWindow {
  const match = spec?.match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
  if (!match) return DEFAULT_WINDOW;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (start >= end || end > 24 * 60) return DEFAULT_WINDOW;
  return { start, end };
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

export function zonedParts(date: Date, timeZone = TIMEZONE): ZonedParts {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, fmt);
  }
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== "literal") parts[p.type] = Number(p.value);
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of a wall-clock time in `timeZone` (DST-safe). */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = TIMEZONE
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

export function minutesOfDay(date: Date, timeZone = TIMEZONE): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** Helsinki calendar day, "YYYY-MM-DD". */
export function dayKey(date: Date, timeZone = TIMEZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function addLocalDays(date: Date, days: number, timeZone: string): { year: number; month: number; day: number } {
  const p = zonedParts(date, timeZone);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** [start, end) of the Helsinki day containing `date`, as UTC instants. */
export function dayRange(date: Date, timeZone = TIMEZONE): { start: Date; end: Date } {
  const today = addLocalDays(date, 0, timeZone);
  const tomorrow = addLocalDays(date, 1, timeZone);
  return {
    start: zonedTimeToUtc(today.year, today.month, today.day, 0, 0, timeZone),
    end: zonedTimeToUtc(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, timeZone),
  };
}

export function isInWindow(date: Date, win: PostingWindow, timeZone = TIMEZONE): boolean {
  const m = minutesOfDay(date, timeZone);
  return m >= win.start && m < win.end;
}

function openingOn(day: { year: number; month: number; day: number }, win: PostingWindow, timeZone: string): Date {
  return zonedTimeToUtc(day.year, day.month, day.day, Math.floor(win.start / 60), win.start % 60, timeZone);
}

/** The next time the window opens strictly after `date`'s current window (today if before it, else tomorrow). */
export function nextOpening(date: Date, win: PostingWindow, timeZone = TIMEZONE): Date {
  const m = minutesOfDay(date, timeZone);
  const day = addLocalDays(date, m < win.start ? 0 : 1, timeZone);
  return openingOn(day, win, timeZone);
}

/** The opening of the next Helsinki day's window (for daily caps). */
export function nextDayOpening(date: Date, win: PostingWindow, timeZone = TIMEZONE): Date {
  return openingOn(addLocalDays(date, 1, timeZone), win, timeZone);
}

export const OPENING_JITTER_MS = 30 * MINUTE;

export function randomBetween(minMs: number, maxMs: number, rand: Rand): number {
  return Math.round(minMs + (maxMs - minMs) * rand());
}

/** `date` if it is inside the posting window, else the next opening plus 0–30 min of jitter. */
export function fitToWindow(date: Date, win: PostingWindow, rand: Rand, timeZone = TIMEZONE): Date {
  if (isInWindow(date, win, timeZone)) return date;
  const opening = nextOpening(date, win, timeZone);
  const jitter = Math.min(randomBetween(0, OPENING_JITTER_MS, rand), Math.max(0, (win.end - win.start) * MINUTE - MINUTE));
  return new Date(opening.getTime() + jitter);
}

export function shuffle<T>(items: readonly T[], rand: Rand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const FIRST_DELAY = { min: 10 * MINUTE, max: 30 * MINUTE };
export const STAGGER = { min: 90 * MINUTE, max: 150 * MINUTE };

/**
 * When each platform gets a new work: the first 10–30 min from now, each next
 * one 90–150 min after the previous, in shuffled order, every time pushed
 * into the posting window.
 */
export function planDeliveries(
  platforms: readonly Platform[],
  now: Date,
  win: PostingWindow,
  rand: Rand,
  timeZone = TIMEZONE
): { platform: Platform; notBefore: Date }[] {
  const order = shuffle(platforms, rand);
  const plan: { platform: Platform; notBefore: Date }[] = [];
  let previous: Date | null = null;
  for (const platform of order) {
    const gap = previous ? randomBetween(STAGGER.min, STAGGER.max, rand) : randomBetween(FIRST_DELAY.min, FIRST_DELAY.max, rand);
    const base: number = previous ? previous.getTime() : now.getTime();
    const at = fitToWindow(new Date(base + gap), win, rand, timeZone);
    plan.push({ platform, notBefore: at });
    previous = at;
  }
  return plan;
}

/** Transient failures retry after 30 min, 2 h, 8 h; the fourth failure is final. */
export const BACKOFF_MS = [30 * MINUTE, 2 * HOUR, 8 * HOUR];

export function backoffDelayMs(failuresSoFar: number): number | null {
  return failuresSoFar >= 1 && failuresSoFar <= BACKOFF_MS.length ? BACKOFF_MS[failuresSoFar - 1] : null;
}

/** A posting run that has held a delivery longer than this is presumed dead. */
export const STALE_POSTING_MS = 15 * MINUTE;
