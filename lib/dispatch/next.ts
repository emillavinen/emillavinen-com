import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { vercelBlobStore } from "./blob";
import { env, logOnce } from "./config";
import { getDb } from "./db/client";
import { defaultNotifier } from "./notify";
import type { RunnerDeps } from "./runner";

/**
 * Wiring for the Next.js side: real clock, real Blob, real fetch, and
 * on-demand revalidation of the pages a write affects.
 */

export function revalidatePaths(paths: string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (err) {
      console.warn(`[dispatch] could not revalidate ${path}`, err instanceof Error ? err.message : err);
    }
  }
}

export async function serverDeps(): Promise<RunnerDeps | null> {
  const db = await getDb();
  if (!db) return null;
  return {
    db,
    now: new Date(),
    blob: vercelBlobStore(),
    rand: Math.random,
    revalidate: revalidatePaths,
    fetch: globalThis.fetch.bind(globalThis),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    notifier: defaultNotifier(),
  };
}

/** `Authorization: Bearer ${CRON_SECRET}`, compared in constant time. */
export function hasCronSecret(request: Request): boolean {
  const secret = env("CRON_SECRET");
  if (!secret) {
    logOnce("no-cron-secret", "CRON_SECRET is not set — the runner endpoint refuses every call.");
    return false;
  }
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Signing secret for short-lived OAuth state cookies. */
export function oauthSecret(): string | null {
  const password = env("ADMIN_PASSWORD");
  return password ? `${password}|dispatch-oauth-state` : null;
}
