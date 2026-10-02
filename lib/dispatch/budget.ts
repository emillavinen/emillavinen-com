import { and, eq, lte, sql } from "drizzle-orm";
import { envInt } from "./config";
import type { Db } from "./db/client";
import { counters } from "./db/schema";

/**
 * Vercel Blob on the Hobby plan includes 2,000 advanced operations (every
 * `put`) and 1 GB of storage a month — and going over does not bill, it
 * locks Blob for 30 days, which would break every image on the site. So
 * DISPATCH keeps its own tally and stops adding works before the limit:
 * new pins wait, the drop page says why, the import stops and resumes later.
 * Defaults leave room for dashboard browsing (which also counts).
 */

export class BlobBudgetError extends Error {}

export function monthlyPutBudget(): number {
  return Math.max(0, envInt("BLOB_MONTHLY_PUT_BUDGET", 1600));
}

export function storageBudgetBytes(): number {
  return Math.max(0, envInt("BLOB_STORAGE_BUDGET_MB", 900)) * 1024 * 1024;
}

export function putKey(now: Date): string {
  return `blob_puts:${now.toISOString().slice(0, 7)}`;
}

const STORAGE_KEY = "blob_bytes";

/** Stored in kilobytes, so the integer counter has room for a large store. */
const toKb = (bytes: number) => Math.ceil(bytes / 1024);

/**
 * Reserves `puts` operations this month and `bytes` of storage, or throws
 * BlobBudgetError. One conditional update per counter, so concurrent writers
 * can't overshoot together.
 */
export async function reserveBlob(db: Db, now: Date, puts: number, bytes: number): Promise<void> {
  const monthKey = putKey(now);
  await db.insert(counters).values({ key: monthKey, value: 0, updatedAt: now }).onConflictDoNothing();
  await db.insert(counters).values({ key: STORAGE_KEY, value: 0, updatedAt: now }).onConflictDoNothing();

  const putBudget = monthlyPutBudget();
  const gotPuts = await db
    .update(counters)
    .set({ value: sql`${counters.value} + ${puts}`, updatedAt: now })
    .where(and(eq(counters.key, monthKey), lte(counters.value, putBudget - puts)))
    .returning({ value: counters.value });
  if (gotPuts.length === 0) {
    throw new BlobBudgetError(
      `This month's image storage operations are used up (${putBudget} of Vercel Blob's 2,000 free). New works wait until next month.`
    );
  }

  const kbBudget = toKb(storageBudgetBytes());
  const kb = toKb(bytes);
  const gotBytes = await db
    .update(counters)
    .set({ value: sql`${counters.value} + ${kb}`, updatedAt: now })
    .where(and(eq(counters.key, STORAGE_KEY), lte(counters.value, kbBudget - kb)))
    .returning({ value: counters.value });
  if (gotBytes.length === 0) {
    // Give the operations back: nothing will be written.
    await db.update(counters).set({ value: sql`${counters.value} - ${puts}` }).where(eq(counters.key, monthKey));
    throw new BlobBudgetError(
      `Image storage is nearly full (${Math.round(storageBudgetBytes() / 1024 / 1024)} MB of Vercel Blob's free 1 GB). New works are paused.`
    );
  }
}

export async function blobUsage(db: Db, now: Date): Promise<{ puts: number; putBudget: number; mb: number; mbBudget: number }> {
  const rows = await db.select().from(counters);
  const value = (key: string) => rows.find((r) => r.key === key)?.value ?? 0;
  return {
    puts: value(putKey(now)),
    putBudget: monthlyPutBudget(),
    mb: Math.round(value(STORAGE_KEY) / 1024),
    mbBudget: Math.round(storageBudgetBytes() / 1024 / 1024),
  };
}
