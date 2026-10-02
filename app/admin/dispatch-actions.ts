"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dispatch/admin";
import { isPlatform, PLATFORM_LABELS, type Platform } from "@/lib/dispatch/config";
import { clearCredentials, setStatus } from "@/lib/dispatch/credentials";
import { deliveries, works } from "@/lib/dispatch/db/schema";
import { splitList } from "@/lib/dispatch/drop";
import { revalidatePaths, serverDeps } from "@/lib/dispatch/next";
import { resolveAlert } from "@/lib/dispatch/notify";
import { checkPlatform, runDispatch } from "@/lib/dispatch/runner";
import { logEvent, setSetting, type SettingKey } from "@/lib/dispatch/store";
import { platformConfig, releaseHeld, workPaths } from "@/lib/dispatch/works";

/**
 * Admin mutations. Middleware guards /admin already; each action checks the
 * session again before touching anything.
 */

async function deps() {
  await requireAdmin();
  const d = await serverDeps();
  if (!d) throw new Error("DATABASE_URL is not set");
  return d;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function setDispatchSetting(formData: FormData) {
  const d = await deps();
  const key = String(formData.get("key")) as SettingKey;
  const value = String(formData.get("value"));
  if (key !== "enabled" && key !== "dry_run") throw new Error("Unknown setting");
  await setSetting(d.db, key, value === "env" ? null : value === "on", d.now);
  await logEvent(d.db, d.now, { type: "setting", message: `${key} → ${value}` });
  revalidatePath("/admin/connections");
}

export async function runNow() {
  const d = await deps();
  let target = "/admin/connections";
  try {
    const report = await runDispatch(d, "admin");
    const done = report.skipped ? `Run skipped (${report.skipped}).` : `Run finished: ${report.handled.length} deliveries handled, ${report.ingested ?? 0} pins ingested${report.errors.length ? `, errors: ${report.errors.join("; ")}` : ""}.`;
    target += `?ok=${encodeURIComponent(done)}`;
  } catch (err) {
    target += `?error=${encodeURIComponent(message(err))}`;
  }
  redirect(target);
}

// ── Connections ────────────────────────────────────────────────────────────

export async function checkConnection(formData: FormData) {
  const d = await deps();
  const platform = String(formData.get("platform"));
  if (!isPlatform(platform)) throw new Error("Unknown platform");
  const config = await platformConfig(d.db);
  const result = await checkPlatform(d, config, platform, Date.now() + 25_000);
  const label = PLATFORM_LABELS[platform];
  redirect(
    result.ok
      ? `/admin/connections?ok=${encodeURIComponent(`${label} checks out: ${result.account}${result.detail ? ` (${result.detail})` : ""}`)}`
      : `/admin/connections?error=${encodeURIComponent(`${label}: ${result.message}`)}`
  );
}

export async function disconnect(formData: FormData) {
  const d = await deps();
  const platform = String(formData.get("platform"));
  if (!isPlatform(platform)) throw new Error("Unknown platform");
  await clearCredentials(d.db, platform, d.now);
  await setStatus(d.db, platform, d.now, "disabled", "Disconnected in admin");
  await logEvent(d.db, d.now, { type: "platform_disconnected", platform });
  revalidatePath("/admin/connections");
}

// ── Works ──────────────────────────────────────────────────────────────────

export async function updateWork(formData: FormData) {
  const d = await deps();
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) redirect(`/admin/works/${id}?error=${encodeURIComponent("Title cannot be empty.")}`);
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
    redirect(`/admin/works/${id}?error=${encodeURIComponent("Year looks wrong.")}`);
  }
  const [work] = await d.db
    .update(works)
    .set({
      title,
      caption: String(formData.get("caption") ?? "").trim(),
      client: String(formData.get("client") ?? "").trim() || null,
      tools: splitList(String(formData.get("tools") ?? "")),
      tags: splitList(String(formData.get("tags") ?? "")),
      year,
      visibleOnSite: formData.get("visible") === "on",
      updatedAt: d.now,
    })
    .where(eq(works.id, id))
    .returning();
  if (work) revalidatePaths(workPaths(work.slug));
  revalidatePath(`/admin/works/${id}`);
  redirect(`/admin/works/${id}?ok=Saved.`);
}

export async function setVisibility(formData: FormData) {
  const d = await deps();
  const id = String(formData.get("id"));
  const visible = formData.get("visible") === "1";
  const [work] = await d.db.update(works).set({ visibleOnSite: visible, updatedAt: d.now }).where(eq(works.id, id)).returning();
  if (work) revalidatePaths(workPaths(work.slug));
  revalidatePath("/admin/works");
  revalidatePath(`/admin/works/${id}`);
}

/**
 * Per-delivery actions:
 * - retry: failed / unknown / skipped → pending now (the runner fits it into the window)
 * - queue: held → pending on the staggered plan
 * - skip: held / pending / failed / unknown → skipped
 * - posted: unknown → posted (Emil checked, it did go out)
 */
export async function deliveryAction(formData: FormData) {
  const d = await deps();
  const id = String(formData.get("delivery"));
  const action = String(formData.get("action"));
  const [row] = await d.db.select().from(deliveries).where(eq(deliveries.id, id));
  if (!row) throw new Error("No such delivery");
  const alertCtx = { db: d.db, now: d.now, notifier: d.notifier };

  if (action === "retry") {
    const moved = await d.db
      .update(deliveries)
      .set({ status: "pending", notBefore: d.now, attempts: 0, lastError: null, skipReason: null, claimedAt: null, updatedAt: d.now })
      .where(and(eq(deliveries.id, id), inArray(deliveries.status, ["failed", "unknown", "skipped"])))
      .returning();
    if (moved.length > 0) {
      await d.db.update(works).set({ queuedAt: d.now, summarySentAt: null, summaryClaimedAt: null }).where(eq(works.id, row.workId));
    }
  } else if (action === "queue") {
    await releaseHeld(d, row.workId, [row.platform as Platform]);
  } else if (action === "skip") {
    await d.db
      .update(deliveries)
      .set({ status: "skipped", skipReason: "manual", claimedAt: null, updatedAt: d.now })
      .where(and(eq(deliveries.id, id), inArray(deliveries.status, ["held", "pending", "failed", "unknown"])));
  } else if (action === "posted") {
    const url = String(formData.get("url") ?? "").trim();
    await d.db
      .update(deliveries)
      .set({ status: "posted", postedAt: d.now, remoteUrl: url || null, lastError: "Marked as posted in admin", updatedAt: d.now })
      .where(and(eq(deliveries.id, id), eq(deliveries.status, "unknown")));
  } else {
    throw new Error("Unknown action");
  }
  if (action !== "queue") await resolveAlert(alertCtx, `unknown:${id}`);
  await logEvent(d.db, d.now, { type: `admin_${action}`, platform: row.platform, workId: row.workId });
  revalidatePath(`/admin/works/${row.workId}`);
  revalidatePath("/admin/works");
}
