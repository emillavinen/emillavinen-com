import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { Platform } from "./config";
import { canEncrypt, decryptJson, encryptJson } from "./crypto";
import type { Db } from "./db/client";
import { platformState, type PlatformStateRow, type PlatformStatus } from "./db/schema";

/**
 * Rotating credentials (OAuth tokens) live encrypted in platform_state.
 * Static keys stay in the environment and are never written here.
 */

export async function getState(db: Db, platform: Platform): Promise<PlatformStateRow | undefined> {
  const rows = await db.select().from(platformState).where(eq(platformState.platform, platform));
  return rows[0];
}

export async function allStates(db: Db): Promise<Map<string, PlatformStateRow>> {
  const rows = await db.select().from(platformState);
  return new Map(rows.map((r) => [r.platform, r]));
}

export async function ensureState(db: Db, platform: Platform, now: Date): Promise<void> {
  await db.insert(platformState).values({ platform, status: "disabled", updatedAt: now }).onConflictDoNothing();
}

export function readCredentials<T>(state: PlatformStateRow | undefined): T | null {
  if (!state?.credentials || !canEncrypt()) return null;
  try {
    return decryptJson<T>(state.credentials);
  } catch (err) {
    console.error(`[dispatch] could not decrypt ${state.platform} credentials — was DISPATCH_ENCRYPTION_KEY changed?`, err);
    return null;
  }
}

export async function saveCredentials(
  db: Db,
  platform: Platform,
  now: Date,
  creds: unknown,
  extra: { account?: string | null; tokenExpiresAt?: Date | null; refreshed?: boolean } = {}
): Promise<void> {
  const values = {
    credentials: encryptJson(creds),
    updatedAt: now,
    ...(extra.account !== undefined ? { account: extra.account } : {}),
    ...(extra.tokenExpiresAt !== undefined ? { tokenExpiresAt: extra.tokenExpiresAt } : {}),
    ...(extra.refreshed ? { tokenRefreshedAt: now } : {}),
  };
  await db
    .insert(platformState)
    .values({ platform, status: "ok", ...values })
    .onConflictDoUpdate({ target: platformState.platform, set: values });
}

export async function clearCredentials(db: Db, platform: Platform, now: Date): Promise<void> {
  await db
    .update(platformState)
    .set({ credentials: null, account: null, tokenExpiresAt: null, tokenRefreshedAt: null, updatedAt: now })
    .where(eq(platformState.platform, platform));
}

export async function setStatus(
  db: Db,
  platform: Platform,
  now: Date,
  status: PlatformStatus,
  note: string | null,
  extra: { ok?: boolean; checked?: boolean } = {}
): Promise<void> {
  await db
    .insert(platformState)
    .values({ platform, status, note, updatedAt: now })
    .onConflictDoUpdate({
      target: platformState.platform,
      set: {
        status,
        note,
        updatedAt: now,
        ...(extra.ok ? { lastOkAt: now } : {}),
        ...(extra.checked ? { lastCheckAt: now } : {}),
      },
    });
}

const LEASE_MS = 30_000;

/**
 * Runs `fn` holding the platform's lease — the DB lock around exchanging a
 * rotating refresh token, so two runs never spend the same one. Returns null
 * when another run holds the lease for longer than `waitMs`.
 */
export async function withLease<T>(
  db: Db,
  platform: Platform,
  now: Date,
  fn: () => Promise<T>,
  opts: { sleep?: (ms: number) => Promise<void>; waitMs?: number } = {}
): Promise<T | null> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  await ensureState(db, platform, now);
  const started = Date.now();
  for (;;) {
    const at = new Date(now.getTime() + (Date.now() - started));
    const claimed = await db
      .update(platformState)
      .set({ lockUntil: new Date(at.getTime() + LEASE_MS) })
      .where(and(eq(platformState.platform, platform), or(isNull(platformState.lockUntil), lt(platformState.lockUntil, at))))
      .returning({ platform: platformState.platform });
    if (claimed.length > 0) {
      try {
        return await fn();
      } finally {
        await db.update(platformState).set({ lockUntil: null }).where(eq(platformState.platform, platform));
      }
    }
    if (Date.now() - started >= (opts.waitMs ?? 8_000)) return null;
    await sleep(500);
  }
}
