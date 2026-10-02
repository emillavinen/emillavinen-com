import Link from "next/link";
import { connection } from "next/server";
import { getSnapshot, pendingTaps } from "@/lib/igout/db";
import { TIME_ZONE, todaysQueue, type Snapshot, type Tap } from "@/lib/igout/logic";
import UnfollowList from "./UnfollowList";

export const metadata = { title: "Instagram" };

// The Mac imports every evening and again in the morning; older than this
// means it hasn't run (lid closed for days, or something broke).
const STALE_AFTER_HOURS = 36;

const heading = {
  fontSize: "var(--text-base)",
  fontWeight: 400,
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase" as const,
  color: "var(--color-fg)",
  margin: 0,
};
const sectionHeading = { ...heading, fontSize: "var(--text-sm)", margin: "0 0 var(--space-4)" };

function when(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return "never";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochSeconds * 1000));
}

async function load(): Promise<{ now: number; saved: { data: Snapshot; pushedAt: number } | null; taps: Tap[]; error: string | null }> {
  await connection();
  const now = Math.floor(Date.now() / 1000);
  try {
    const [saved, taps] = await Promise.all([getSnapshot(), pendingTaps()]);
    return { now, saved, taps, error: null };
  } catch (err) {
    return { now, saved: null, taps: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export default async function InstagramAdmin() {
  const { now, saved, taps, error } = await load();

  const stale = saved !== null && now - saved.pushedAt > STALE_AFTER_HOURS * 3600;
  const queue = saved ? todaysQueue(saved.data, taps, now) : null;
  const stats = saved?.data.stats;

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "var(--space-8) var(--space-4) var(--space-16)", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <h1 style={heading}>Instagram</h1>
        <Link href="/admin" style={{ color: "var(--color-muted)", textDecoration: "none", fontSize: "var(--text-sm)" }}>
          ← Posts
        </Link>
      </div>

      {saved && (
        <p style={{ fontSize: "var(--text-xs)", margin: "0 0 var(--space-8)", color: stale ? "var(--color-link)" : "var(--color-muted)" }}>
          Updated {when(saved.pushedAt)}
          {stale && ". The Mac hasn't sent anything for a while: open it, or run python3 -m igout push."}
        </p>
      )}

      {error ? (
        <div style={{ border: "1px solid #fca5a5", padding: "var(--space-4)", fontSize: "var(--text-sm)", color: "#dc2626" }}>
          <p style={{ fontWeight: 500, margin: "0 0 var(--space-1)" }}>Database not available</p>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : !saved || !queue ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-fg-secondary)", marginTop: "var(--space-8)" }}>
          Nothing uploaded yet. On the Mac, run <code>python3 -m igout push</code> in the instagram stats folder.
        </p>
      ) : (
        <>
          <section style={{ marginBottom: "var(--space-12)" }}>
            <h2 style={sectionHeading}>Unfollow today</h2>
            <UnfollowList cards={queue.cards} remaining={queue.remaining} />
          </section>

          {stats && (
            <section>
              <h2 style={sectionHeading}>Stats</h2>
              <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-2) var(--space-4)", fontSize: "var(--text-sm)", margin: 0 }}>
                {[
                  ["Following", stats.following],
                  ["Prospects", stats.prospects],
                  ["Replied", stats.prospects ? `${stats.replied} (${Math.round((100 * stats.replied) / stats.prospects)}%)` : stats.replied],
                  [`Waiting (under ${saved.data.wait_days ?? 14} days)`, stats.waiting],
                  ["Unfollowed, last 7 days", stats.unfollowed_7d],
                  ["Unfollowed today", queue.doneToday],
                  ["Chats", Object.entries(stats.chats).sort().map(([k, v]) => `${v} ${k}`).join(" · ")],
                  ["Last export imported", when(stats.last_import)],
                  ["Mac last synced", when(stats.last_sync)],
                ].map(([name, value]) => (
                  <div key={String(name)} style={{ display: "contents" }}>
                    <dt style={{ color: "var(--color-fg-secondary)" }}>{name}</dt>
                    <dd style={{ margin: 0, textAlign: "right", color: "var(--color-fg)" }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </>
      )}
    </div>
  );
}
