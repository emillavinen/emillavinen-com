import { neon } from "@neondatabase/serverless";
import type { Snapshot, Tap, TapStatus } from "./logic";

/**
 * Neon Postgres storage for /admin/instagram: one snapshot row uploaded by
 * the Mac, and the taps made on the page until the Mac has applied them.
 * Tables are created on first use; applied taps are kept 30 days.
 */

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (Vercel: Storage → Neon)");
  return neon(url);
}

let ready: Promise<void> | null = null;

function ensureTables(sql: ReturnType<typeof client>): Promise<void> {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS igout_snapshot (
      id integer PRIMARY KEY CHECK (id = 1),
      data jsonb NOT NULL,
      pushed_at bigint NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS igout_actions (
      id serial PRIMARY KEY,
      thread_id text NOT NULL,
      status text NOT NULL CHECK (status IN ('done', 'skipped')),
      created_at bigint NOT NULL,
      applied_at bigint
    )`;
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

async function db() {
  const sql = client();
  await ensureTables(sql);
  return sql;
}

const now = () => Math.floor(Date.now() / 1000);

export async function getSnapshot(): Promise<{ data: Snapshot; pushedAt: number } | null> {
  const sql = await db();
  const rows = await sql`SELECT data, pushed_at FROM igout_snapshot WHERE id = 1`;
  return rows.length ? { data: rows[0].data as Snapshot, pushedAt: Number(rows[0].pushed_at) } : null;
}

/** Replace the snapshot and mark the taps the Mac has applied, in one transaction. */
export async function saveSnapshot(data: Snapshot, appliedIds: number[]): Promise<void> {
  const sql = await db();
  const t = now();
  await sql.transaction([
    sql`INSERT INTO igout_snapshot (id, data, pushed_at) VALUES (1, ${JSON.stringify(data)}::jsonb, ${t})
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, pushed_at = EXCLUDED.pushed_at`,
    sql`UPDATE igout_actions SET applied_at = ${t} WHERE id = ANY(${appliedIds}::int[]) AND applied_at IS NULL`,
    sql`DELETE FROM igout_actions WHERE applied_at IS NOT NULL AND applied_at < ${t - 30 * 86400}`,
  ]);
}

export async function pendingTaps(): Promise<Tap[]> {
  const sql = await db();
  const rows = await sql`SELECT id, thread_id, status, created_at FROM igout_actions WHERE applied_at IS NULL ORDER BY id`;
  return rows.map((r) => ({
    id: Number(r.id),
    thread_id: String(r.thread_id),
    status: r.status as TapStatus,
    created_at: Number(r.created_at),
  }));
}

export async function addTap(threadId: string, status: TapStatus): Promise<number> {
  const sql = await db();
  const rows = await sql`INSERT INTO igout_actions (thread_id, status, created_at)
                         VALUES (${threadId}, ${status}, ${now()}) RETURNING id`;
  return Number(rows[0].id);
}

/** Undo a tap the Mac hasn't picked up yet. */
export async function removeTap(id: number): Promise<boolean> {
  const sql = await db();
  const rows = await sql`DELETE FROM igout_actions WHERE id = ${id} AND applied_at IS NULL RETURNING id`;
  return rows.length > 0;
}
