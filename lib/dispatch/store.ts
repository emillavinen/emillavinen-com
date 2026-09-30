import { and, eq, lt } from "drizzle-orm";
import { envBool } from "./config";
import type { Db } from "./db/client";
import { events, settings } from "./db/schema";

/**
 * Settings and the event log. Dry run and the kill switch default to the
 * environment (DRY_RUN, DISPATCH_ENABLED) and can be overridden from /admin
 * without a redeploy; the override lives in the `settings` table.
 */

export interface DispatchSettings {
  enabled: boolean;
  dryRun: boolean;
}

export type SettingKey = "enabled" | "dry_run";

export function envSettings(): DispatchSettings {
  return {
    enabled: envBool("DISPATCH_ENABLED", true),
    dryRun: envBool("DRY_RUN", true),
  };
}

export async function getSettings(db: Db): Promise<DispatchSettings & { overridden: SettingKey[] }> {
  const base = envSettings();
  const rows = await db.select().from(settings);
  const overridden: SettingKey[] = [];
  for (const row of rows) {
    if (row.key === "enabled" && typeof row.value === "boolean") {
      base.enabled = row.value;
      overridden.push("enabled");
    }
    if (row.key === "dry_run" && typeof row.value === "boolean") {
      base.dryRun = row.value;
      overridden.push("dry_run");
    }
  }
  return { ...base, overridden };
}

export async function setSetting(db: Db, key: SettingKey, value: boolean | null, now: Date): Promise<void> {
  if (value === null) {
    await db.delete(settings).where(eq(settings.key, key));
    return;
  }
  await db
    .insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } });
}

export interface EventInput {
  type: string;
  message?: string;
  platform?: string | null;
  workId?: string | null;
  data?: Record<string, unknown> | null;
}

/** Appends to the event log, and mirrors it to the function log. */
export async function logEvent(db: Db, now: Date, event: EventInput): Promise<void> {
  const parts = [`[dispatch] ${event.type}`];
  if (event.platform) parts.push(event.platform);
  if (event.message) parts.push(event.message);
  console.info(parts.join(" · "));
  try {
    await db.insert(events).values({
      at: now,
      type: event.type,
      platform: event.platform ?? null,
      workId: event.workId ?? null,
      message: event.message ?? "",
      data: event.data ?? null,
    });
  } catch (err) {
    console.error("[dispatch] could not write event", err);
  }
}

export const EVENT_RETENTION_DAYS = 90;

export async function pruneEvents(db: Db, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86_400_000);
  await db.delete(events).where(and(lt(events.at, cutoff)));
}
