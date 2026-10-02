/**
 * Instagram outreach page (/admin/instagram): the parts that don't touch the
 * database. The Mac (igout, run every evening) is the source of truth; it
 * uploads a snapshot of today's unfollow cards and picks up the taps made on
 * this page. Only usernames, display names and counts are ever stored: no
 * message text.
 */

export type Card = {
  thread_id: string;
  username: string | null;
  title: string;
  days_since_last_dm: number;
  state: string;
};

export type Stats = {
  following: number;
  chats: Record<string, number>;
  prospects: number;
  replied: number;
  waiting: number;
  unfollowed_7d: number;
  last_import: number | null;
  last_sync: number | null;
};

export type Snapshot = {
  generated_at: number;
  cap: number | null;
  done_today: number;
  wait_days: number | null;
  cards: Card[];
  stats: Stats;
};

export type TapStatus = "done" | "skipped";

export type Tap = {
  id: number;
  thread_id: string;
  status: TapStatus;
  created_at: number;
};

export const TIME_ZONE = "Europe/Helsinki";
const THREAD_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isThreadId(value: unknown): value is string {
  return typeof value === "string" && THREAD_ID.test(value);
}

export function isTapStatus(value: unknown): value is TapStatus {
  return value === "done" || value === "skipped";
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Rebuild an uploaded snapshot from known fields only, so nothing else (for
 * example message text from a buggy client) can end up in the database.
 * Returns null when the shape is wrong.
 */
export function cleanSnapshot(input: unknown): Snapshot | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  if (!Array.isArray(s.cards) || !s.stats || typeof s.stats !== "object") return null;
  const cards: Card[] = [];
  for (const raw of s.cards.slice(0, 1000)) {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    if (!isThreadId(c.thread_id)) return null;
    cards.push({
      thread_id: c.thread_id,
      username: typeof c.username === "string" ? c.username.slice(0, 64) : null,
      title: str(c.title, 120),
      days_since_last_dm: num(c.days_since_last_dm),
      state: str(c.state, 40),
    });
  }
  const st = s.stats as Record<string, unknown>;
  const chats: Record<string, number> = {};
  if (st.chats && typeof st.chats === "object") {
    for (const [k, v] of Object.entries(st.chats as Record<string, unknown>).slice(0, 20)) {
      chats[k.slice(0, 40)] = num(v);
    }
  }
  return {
    generated_at: num(s.generated_at),
    cap: numOrNull(s.cap),
    done_today: num(s.done_today),
    wait_days: numOrNull(s.wait_days),
    cards,
    stats: {
      following: num(st.following),
      chats,
      prospects: num(st.prospects),
      replied: num(st.replied),
      waiting: num(st.waiting),
      unfollowed_7d: num(st.unfollowed_7d),
      last_import: numOrNull(st.last_import),
      last_sync: numOrNull(st.last_sync),
    },
  };
}

/** YYYY-MM-DD of an epoch-seconds time in Helsinki. */
export function helsinkiDay(epochSeconds: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(epochSeconds * 1000)
  );
}

/**
 * Today's cards: everything in the snapshot that hasn't been tapped since,
 * plus how many more unfollows today's cap allows. "Done" taps count toward
 * the cap, "Skip" doesn't. The snapshot's own count only applies when it was
 * made today.
 */
export function todaysQueue(snapshot: Snapshot, pending: Tap[], nowSeconds: number) {
  const today = helsinkiDay(nowSeconds);
  const tapped = new Set(pending.map((t) => t.thread_id));
  const doneOnMac = helsinkiDay(snapshot.generated_at) === today ? snapshot.done_today : 0;
  const doneHere = pending.filter((t) => t.status === "done" && helsinkiDay(t.created_at) === today).length;
  const doneToday = doneOnMac + doneHere;
  const cards = snapshot.cards.filter((c) => !tapped.has(c.thread_id));
  const remaining = snapshot.cap == null ? cards.length : Math.max(0, snapshot.cap - doneToday);
  return { cards, remaining, doneToday };
}
