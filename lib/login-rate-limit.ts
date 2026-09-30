import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/dispatch/db/client";
import { events } from "@/lib/dispatch/db/schema";

/**
 * Failed admin logins are limited per IP: five in fifteen minutes. The
 * count lives in the DISPATCH event log when the store is configured (so it
 * holds across serverless instances) and in memory otherwise.
 */

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const memory = new Map<string, number[]>();

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

function recent(ip: string, now: number): number[] {
  const list = (memory.get(ip) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  memory.set(ip, list);
  return list;
}

export async function isLoginBlocked(ip: string, now = Date.now()): Promise<boolean> {
  const db = await getDb().catch(() => null);
  if (db) {
    try {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(events)
        .where(and(eq(events.type, "login_failed"), gte(events.at, new Date(now - LOGIN_WINDOW_MS)), sql`${events.data}->>'ip' = ${ip}`));
      return Number(row?.n ?? 0) >= LOGIN_MAX_FAILURES;
    } catch (err) {
      console.error("[admin] rate limit lookup failed, using memory", err);
    }
  }
  return recent(ip, now).length >= LOGIN_MAX_FAILURES;
}

export async function recordLoginFailure(ip: string, now = Date.now()): Promise<void> {
  recent(ip, now).push(now);
  const db = await getDb().catch(() => null);
  if (!db) return;
  try {
    await db.insert(events).values({ at: new Date(now), type: "login_failed", message: "admin login failed", data: { ip } });
  } catch (err) {
    console.error("[admin] could not record login failure", err);
  }
}
