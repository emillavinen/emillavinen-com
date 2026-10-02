import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, max, notExists, or, sql } from "drizzle-orm";
import { capFor, envInt, isPlatform, PLATFORM_LABELS, siteUrl, type Platform } from "./config";
import { ensureState, setStatus } from "./credentials";
import { assets, counters, deliveries, events, platformState, works, type Delivery, type Work } from "./db/schema";
import { raiseAlert, resolveAlert, sendDueReminders, type Notifier } from "./notify";
import { processFeedItems, readBoards } from "./pinterest/watcher";
import { ADAPTERS } from "./platforms";
import { utmLink } from "./platforms/format";
import { PlatformError, type Adapter, type AdapterContext } from "./platforms/types";
import {
  backoffDelayMs,
  dayKey,
  dayRange,
  fitToWindow,
  isInWindow,
  nextDayOpening,
  OPENING_JITTER_MS,
  parseWindow,
  randomBetween,
  STALE_POSTING_MS,
} from "./schedule";
import { getSettings, logEvent, pruneEvents } from "./store";
import { backfillHeld, platformConfig, releaseHeld, type PlatformConfig, type WorkDeps } from "./works";

/**
 * The runner: one call reads the Pinterest boards, then posts what is due.
 * Idempotent and safe to call often or concurrently — every state change is
 * a conditional update that only one caller can win.
 */

export type Trigger = "github" | "vercel-cron" | "manual" | "admin" | "test";

export interface RunnerDeps extends WorkDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  notifier: Notifier;
  adapters?: Partial<Record<Platform, Adapter>>;
  /** Wall-clock budget for the whole call. */
  budgetMs?: number;
}

export interface RunReport {
  trigger: Trigger;
  skipped?: string;
  dryRun?: boolean;
  boards?: number;
  newPins?: number;
  ingested?: number;
  dripped?: number;
  handled: { platform: string; work: string; outcome: string }[];
  summaries: number;
  errors: string[];
}

export const MAX_DELIVERIES_PER_RUN = 3;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A needs_attention platform is re-checked this often, so its queue resumes by itself. */
const RECHECK_MS = 3 * HOUR;
const GITHUB_TRIGGER_STALE_MS = 6 * HOUR;

function label(platform: string): string {
  return isPlatform(platform) ? PLATFORM_LABELS[platform] : platform;
}

export async function runDispatch(deps: RunnerDeps, trigger: Trigger): Promise<RunReport> {
  const started = Date.now();
  const deadline = started + (deps.budgetMs ?? 50_000);
  const report: RunReport = { trigger, handled: [], summaries: 0, errors: [] };
  const { db, now } = deps;

  const settings = await getSettings(db);
  if (!settings.enabled) {
    console.info("[dispatch] DISPATCH_ENABLED is off — the runner does nothing.");
    return { ...report, skipped: "disabled" };
  }
  report.dryRun = settings.dryRun;
  await logEvent(db, now, { type: "run", message: `trigger ${trigger}${settings.dryRun ? " · dry run" : ""}`, data: { trigger, dryRun: settings.dryRun } });

  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      const message = `${name}: ${err instanceof Error ? err.message : String(err)}`;
      report.errors.push(message);
      console.error(`[dispatch] ${message}`, err);
      await logEvent(db, now, { type: "runner_error", message });
    }
  };

  await step("stale", () => markStale(deps));
  let config: PlatformConfig = { enabled: [], states: new Map() };
  await step("platforms", async () => {
    config = await syncPlatforms(deps, deadline);
  });
  await step("pinterest", async () => {
    const read = await readBoards(deps);
    report.boards = read.boards;
    report.newPins = read.newItems;
    report.ingested = await processFeedItems(deps, Math.min(deadline - 25_000, started + 25_000));
    config = await platformConfig(db);
  });
  await step("drip", async () => {
    report.dripped = await drip(deps, config);
  });
  await step("deliveries", () => processDue(deps, config, settings.dryRun, deadline, report));
  await step("summaries", async () => {
    report.summaries = await sendSummaries(deps);
  });
  await step("trigger", () => checkTrigger(deps, trigger));
  await step("reminders", () => sendDueReminders({ db, now, notifier: deps.notifier }));
  await step("prune", () => pruneEvents(db, now));
  return report;
}

function adapterOf(deps: RunnerDeps, platform: Platform): Adapter {
  return deps.adapters?.[platform] ?? ADAPTERS[platform];
}

function adapterCtx(deps: RunnerDeps, config: PlatformConfig, platform: Platform, deadline: number): AdapterContext {
  return { db: deps.db, now: deps.now, fetch: deps.fetch, sleep: deps.sleep, deadline, state: config.states.get(platform) };
}

// ── Stale claims ───────────────────────────────────────────────────────────

/** A delivery still `posting` after 15 minutes belongs to a run that died mid-post. */
async function markStale(deps: RunnerDeps): Promise<void> {
  const { db, now } = deps;
  const cutoff = new Date(now.getTime() - STALE_POSTING_MS);
  const stale = await db
    .update(deliveries)
    .set({ status: "unknown", lastError: "A run stopped mid-post; it may or may not have posted", updatedAt: now })
    .where(and(eq(deliveries.status, "posting"), lt(deliveries.claimedAt, cutoff)))
    .returning();
  for (const d of stale) await alertUnknown(deps, d);
}

async function alertUnknown(deps: RunnerDeps, d: Delivery): Promise<void> {
  const [work] = await deps.db.select({ title: works.title, id: works.id }).from(works).where(eq(works.id, d.workId));
  await logEvent(deps.db, deps.now, { type: "delivery_unknown", platform: d.platform, workId: d.workId, message: d.lastError ?? "" });
  await raiseAlert(
    { db: deps.db, now: deps.now, notifier: deps.notifier },
    `unknown:${d.id}`,
    `${label(d.platform)} — "${work?.title ?? d.workId}" may or may not have posted (${d.lastError ?? "run stopped mid-post"}). Check ${label(d.platform)}, then mark it posted or retry: ${siteUrl()}/admin/works/${d.workId}`
  );
}

// ── Platforms ──────────────────────────────────────────────────────────────

async function syncPlatforms(deps: RunnerDeps, deadline: number): Promise<PlatformConfig> {
  const { db, now } = deps;
  const alertCtx = { db, now, notifier: deps.notifier };
  let config = await platformConfig(db);
  for (const platform of Object.keys(ADAPTERS) as Platform[]) {
    await ensureState(db, platform, now);
    const adapter = adapterOf(deps, platform);
    const state = config.states.get(platform);
    const configured = adapter.configured(state);
    if (!configured) {
      if (state?.status !== "disabled") {
        await setStatus(db, platform, now, "disabled", `Not configured: ${adapter.missingEnv().join(", ") || "not connected"}`);
        await resolveAlert(alertCtx, `platform:${platform}`);
      }
      continue;
    }
    if (!state || state.status === "disabled") await enablePlatform(db, platform, now);
    // Every run, not only on enabling: works written by another process (the
    // local backlog import) may lack a row for a platform enabled here.
    else await backfillHeld(db, platform, now);
    try {
      const result = await adapter.maintain?.(adapterCtx(deps, config, platform, deadline));
      const expiresAt = result && result.expiresAt;
      if (expiresAt && expiresAt.getTime() - now.getTime() < 7 * DAY) {
        const when = expiresAt.getTime() <= now.getTime() ? "has expired" : `expires on ${expiresAt.toISOString().slice(0, 10)}`;
        await raiseAlert(alertCtx, `expiry:${platform}`, `${label(platform)} connection ${when} — reconnect at ${siteUrl()}/admin/connections`);
      } else {
        await resolveAlert(alertCtx, `expiry:${platform}`);
      }
    } catch (err) {
      if (err instanceof PlatformError && (err.kind === "auth" || err.kind === "credits")) {
        await pausePlatform(deps, platform, err.message);
      } else {
        console.warn(`[dispatch] ${platform} maintenance failed`, err);
      }
    }
    const fresh = (await platformConfig(db)).states.get(platform);
    if (fresh?.status === "needs_attention" && (!fresh.lastCheckAt || now.getTime() - fresh.lastCheckAt.getTime() >= RECHECK_MS)) {
      await checkPlatform(deps, { ...config, states: (await platformConfig(db)).states }, platform, deadline);
    }
  }
  config = await platformConfig(db);
  return config;
}

/**
 * A platform that just became usable: status ok, and every existing work
 * gets a `held` delivery for it (backlog, never pending — no floods).
 */
export async function enablePlatform(db: RunnerDeps["db"], platform: Platform, now: Date): Promise<void> {
  // Backfill first: if it fails, the platform stays disabled and the next run tries again.
  await backfillHeld(db, platform, now);
  await setStatus(db, platform, now, "ok", null);
  await logEvent(db, now, { type: "platform_enabled", platform, message: "existing works get held deliveries (backlog)" });
}

async function pausePlatform(deps: RunnerDeps, platform: Platform, message: string): Promise<void> {
  const { db, now } = deps;
  await setStatus(db, platform, now, "needs_attention", message, { checked: true });
  await logEvent(db, now, { type: "platform_needs_attention", platform, message });
  await raiseAlert(
    { db, now, notifier: deps.notifier },
    `platform:${platform}`,
    `${label(platform)} needs attention: ${message}. Its queue is paused and resumes by itself once it checks out (${siteUrl()}/admin/connections).`
  );
}

/** Calls the platform's cheap authenticated check; flips its status either way. */
export async function checkPlatform(deps: RunnerDeps, config: PlatformConfig, platform: Platform, deadline: number) {
  const { db, now } = deps;
  const adapter = adapterOf(deps, platform);
  try {
    const result = await adapter.check(adapterCtx(deps, config, platform, deadline));
    await setStatus(db, platform, now, "ok", result.detail ?? null, { ok: true, checked: true });
    await db.update(platformState).set({ account: result.account }).where(eq(platformState.platform, platform));
    await resolveAlert({ db, now, notifier: deps.notifier }, `platform:${platform}`, `${label(platform)} checks out again — its queue resumes.`);
    return { ok: true as const, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof PlatformError && (err.kind === "auth" || err.kind === "credits")) {
      await pausePlatform(deps, platform, message);
    } else {
      await db.update(platformState).set({ lastCheckAt: now }).where(eq(platformState.platform, platform));
    }
    return { ok: false as const, message };
  }
}

// ── Backlog drip ───────────────────────────────────────────────────────────

/** Moves at most one held work per run into the queue, up to BACKLOG_DRIP_PER_DAY a day, oldest first. */
async function drip(deps: RunnerDeps, config: PlatformConfig): Promise<number> {
  const perDay = envInt("BACKLOG_DRIP_PER_DAY", 0);
  if (perDay <= 0 || config.enabled.length === 0) return 0;
  const { db, now } = deps;
  const key = `drip:${dayKey(now)}`;
  await db.insert(counters).values({ key, value: 0, updatedAt: now }).onConflictDoNothing();
  const slot = await db
    .update(counters)
    .set({ value: sql`${counters.value} + 1`, updatedAt: now })
    .where(and(eq(counters.key, key), lt(counters.value, perDay)))
    .returning({ value: counters.value });
  if (slot.length === 0) return 0;

  const busy = db
    .select({ one: sql`1` })
    .from(deliveries)
    .where(and(eq(deliveries.workId, works.id), inArray(deliveries.status, ["pending", "posting"])));
  const held = db
    .select({ one: sql`1` })
    .from(deliveries)
    .where(and(eq(deliveries.workId, works.id), eq(deliveries.status, "held"), inArray(deliveries.platform, config.enabled)));
  const [candidate] = await db
    .select({ id: works.id, title: works.title })
    .from(works)
    .where(and(eq(works.visibleOnSite, true), sql`EXISTS (${held})`, notExists(busy)))
    .orderBy(asc(works.createdAt))
    .limit(1);
  const moved = candidate ? await releaseHeld(deps, candidate.id, config.enabled) : 0;
  if (moved === 0) {
    await db.update(counters).set({ value: sql`${counters.value} - 1` }).where(eq(counters.key, key));
    return 0;
  }
  await logEvent(db, now, { type: "drip", workId: candidate.id, message: `${candidate.title}: ${moved} held deliveries queued` });
  return 1;
}

// ── Deliveries ─────────────────────────────────────────────────────────────

async function postedToday(deps: RunnerDeps, platform: Platform): Promise<number> {
  const { start, end } = dayRange(deps.now);
  const [row] = await deps.db
    .select({ n: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.platform, platform),
        or(eq(deliveries.status, "posting"), and(eq(deliveries.status, "posted"), gte(deliveries.postedAt, start), lt(deliveries.postedAt, end)))
      )
    );
  return Number(row?.n ?? 0);
}

async function reschedule(deps: RunnerDeps, id: string, at: Date, note?: string): Promise<void> {
  await deps.db
    .update(deliveries)
    .set({ notBefore: at, updatedAt: deps.now, ...(note ? { lastError: note } : {}) })
    .where(and(eq(deliveries.id, id), eq(deliveries.status, "pending")));
}

async function processDue(deps: RunnerDeps, config: PlatformConfig, dryRun: boolean, deadline: number, report: RunReport): Promise<void> {
  const { db, now } = deps;
  const win = parseWindow();
  const rand = deps.rand;
  const due = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.status, "pending"), lte(deliveries.notBefore, now)))
    .orderBy(asc(deliveries.notBefore))
    .limit(30);

  const worksThisRun = new Set<string>();
  // Platforms paused during this run: their other deliveries wait.
  const pausedNow = new Set<string>();
  let handled = 0;
  for (const d of due) {
    if (handled >= MAX_DELIVERIES_PER_RUN) break;
    // Leave room for the slowest platform to finish inside the function limit.
    if (Date.now() > deadline - 20_000) break;
    if (worksThisRun.has(d.workId)) continue;

    if (!isPlatform(d.platform)) {
      await skip(deps, d, "unknown_platform");
      continue;
    }
    const platform = d.platform;
    const adapter = adapterOf(deps, platform);
    const state = config.states.get(platform);
    if (!adapter.configured(state)) {
      await skip(deps, d, "disabled");
      continue;
    }
    if (state?.status === "needs_attention" || pausedNow.has(platform)) continue; // queue paused

    if (!isInWindow(now, win)) {
      await reschedule(deps, d.id, fitToWindow(now, win, rand));
      continue;
    }
    if ((await postedToday(deps, platform)) >= capFor(platform)) {
      const at = new Date(nextDayOpening(now, win).getTime() + randomBetween(0, OPENING_JITTER_MS, rand));
      await reschedule(deps, d.id, at);
      continue;
    }
    const [work] = await db.select().from(works).where(eq(works.id, d.workId));
    if (!work) continue;
    if (!work.visibleOnSite) {
      await skip(deps, d, "hidden");
      continue;
    }

    // Claim before touching the platform: only one caller wins this update.
    const claimed = await db
      .update(deliveries)
      .set({ status: "posting", claimedAt: now, updatedAt: now })
      .where(and(eq(deliveries.id, d.id), eq(deliveries.status, "pending"), lte(deliveries.notBefore, now)))
      .returning();
    if (claimed.length === 0) continue;
    worksThisRun.add(d.workId);
    handled++;

    const workAssets = await db.select().from(assets).where(eq(assets.workId, work.id)).orderBy(asc(assets.position));
    const link = utmLink(work.slug, platform);
    const text = adapter.format(work, link);

    if (dryRun) {
      await db
        .update(deliveries)
        .set({ status: "skipped", skipReason: "dry_run", text, claimedAt: null, updatedAt: now })
        .where(and(eq(deliveries.id, d.id), eq(deliveries.status, "posting")));
      await logEvent(db, now, { type: "dry_run", platform, workId: work.id, message: text });
      report.handled.push({ platform, work: work.title, outcome: "dry run" });
      continue;
    }

    try {
      const result = await adapter.post(adapterCtx(deps, config, platform, deadline), { work, assets: workAssets, text, link });
      await db
        .update(deliveries)
        .set({
          status: "posted",
          remoteId: result.remoteId,
          remoteUrl: result.remoteUrl,
          postedAt: now,
          text,
          lastError: result.note ?? null,
          claimedAt: null,
          updatedAt: now,
        })
        .where(and(eq(deliveries.id, d.id), eq(deliveries.status, "posting")));
      await setStatus(db, platform, now, "ok", state?.note ?? null, { ok: true });
      await logEvent(db, now, { type: "posted", platform, workId: work.id, message: result.remoteUrl ?? result.remoteId });
      report.handled.push({ platform, work: work.title, outcome: "posted" });
    } catch (err) {
      const outcome = await handleFailure(deps, claimed[0], work, platform, text, err);
      if (err instanceof PlatformError && (err.kind === "auth" || err.kind === "credits")) pausedNow.add(platform);
      report.handled.push({ platform, work: work.title, outcome });
    }
  }
}

async function skip(deps: RunnerDeps, d: Delivery, reason: string): Promise<void> {
  await deps.db
    .update(deliveries)
    .set({ status: "skipped", skipReason: reason, updatedAt: deps.now })
    .where(and(eq(deliveries.id, d.id), eq(deliveries.status, "pending")));
}

async function handleFailure(deps: RunnerDeps, d: Delivery, work: Work, platform: Platform, text: string, err: unknown): Promise<string> {
  const { db, now } = deps;
  const pe = err instanceof PlatformError ? err : new PlatformError("transient", err instanceof Error ? err.message : String(err));
  const mine = and(eq(deliveries.id, d.id), eq(deliveries.status, "posting"));
  await logEvent(db, now, { type: `delivery_${pe.kind}`, platform, workId: work.id, message: pe.message });

  switch (pe.kind) {
    case "rate_limited": {
      // Not counted as an attempt.
      const at = pe.retryAt && pe.retryAt > now ? pe.retryAt : new Date(now.getTime() + HOUR);
      await db.update(deliveries).set({ status: "pending", notBefore: at, lastError: pe.message, claimedAt: null, text, updatedAt: now }).where(mine);
      return "rate limited";
    }
    case "transient": {
      const attempts = d.attempts + 1;
      const delay = backoffDelayMs(attempts);
      if (delay !== null) {
        const at = fitToWindow(new Date(now.getTime() + delay), parseWindow(), deps.rand);
        await db.update(deliveries).set({ status: "pending", attempts, notBefore: at, lastError: pe.message, claimedAt: null, text, updatedAt: now }).where(mine);
        return `retry at ${at.toISOString()}`;
      }
      await db.update(deliveries).set({ status: "failed", attempts, lastError: pe.message, claimedAt: null, text, updatedAt: now }).where(mine);
      return "failed";
    }
    case "auth":
    case "credits": {
      await db.update(deliveries).set({ status: "failed", attempts: d.attempts + 1, lastError: pe.message, claimedAt: null, text, updatedAt: now }).where(mine);
      await pausePlatform(deps, platform, pe.kind === "credits" && platform === "x" ? `top up X credits (${pe.message})` : pe.message);
      return "failed (needs attention)";
    }
    case "rejected": {
      await db.update(deliveries).set({ status: "failed", attempts: d.attempts + 1, lastError: pe.message, claimedAt: null, text, updatedAt: now }).where(mine);
      return "failed (rejected)";
    }
    case "ambiguous": {
      const [row] = await db.update(deliveries).set({ status: "unknown", lastError: pe.message, claimedAt: null, text, updatedAt: now }).where(mine).returning();
      if (row) await alertUnknown(deps, row);
      return "unknown";
    }
  }
}

// ── Summaries ──────────────────────────────────────────────────────────────

function describe(d: Delivery): string {
  const name = label(d.platform);
  switch (d.status) {
    case "posted":
      return `${name}: ${d.remoteUrl ?? d.remoteId ?? "posted"}${d.lastError ? ` (${d.lastError})` : ""}`;
    case "failed":
      return `${name}: failed — ${d.lastError ?? "unknown error"}`;
    case "unknown":
      return `${name}: unknown — ${d.lastError ?? "may or may not have posted"}`;
    case "held":
      return `${name}: held (backlog)`;
    case "skipped": {
      if (d.skipReason === "dry_run") return `${name}: dry run, would post:\n${indent(d.text ?? "")}`;
      const reasons: Record<string, string> = {
        disabled: "not connected",
        deselected: "unticked",
        hidden: "work hidden from the site",
        manual: "skipped by hand",
      };
      return `${name}: skipped (${reasons[d.skipReason ?? ""] ?? d.skipReason ?? "skipped"})`;
    }
    default:
      return `${name}: ${d.status}`;
  }
}

export function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => (l ? `  ${l}` : ""))
    .join("\n");
}

/** One summary per work, once all of its queued deliveries have settled. */
async function sendSummaries(deps: RunnerDeps): Promise<number> {
  const { db, now } = deps;
  const unsettled = db
    .select({ one: sql`1` })
    .from(deliveries)
    .where(and(eq(deliveries.workId, works.id), inArray(deliveries.status, ["pending", "posting"])));
  const ready = await db
    .select()
    .from(works)
    .where(and(isNotNull(works.queuedAt), isNull(works.summarySentAt), notExists(unsettled)))
    .orderBy(asc(works.queuedAt))
    .limit(10);
  let sent = 0;
  for (const work of ready) {
    const claimed = await db
      .update(works)
      .set({ summaryClaimedAt: now })
      .where(
        and(
          eq(works.id, work.id),
          isNull(works.summarySentAt),
          or(isNull(works.summaryClaimedAt), lt(works.summaryClaimedAt, new Date(now.getTime() - 10 * 60_000)))
        )
      )
      .returning({ id: works.id });
    if (claimed.length === 0) continue;
    const rows = await db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.workId, work.id), gte(deliveries.updatedAt, work.queuedAt!)))
      .orderBy(asc(deliveries.platform));
    const lines = rows.filter((d) => !(d.status === "skipped" && d.skipReason === "deselected")).map(describe);
    const message = [work.title, ...lines, `${siteUrl()}/work/${work.slug}`].join("\n");
    await deps.notifier.send(message);
    await db.update(works).set({ summarySentAt: now }).where(eq(works.id, work.id));
    await logEvent(db, now, { type: "summary", workId: work.id, message: work.title });
    sent++;
  }
  return sent;
}

// ── Trigger health ─────────────────────────────────────────────────────────

/**
 * GitHub pauses scheduled workflows in public repos after 60 days without
 * commits. The daily Vercel cron notices when the hourly GitHub trigger has
 * gone quiet for more than six hours.
 */
async function checkTrigger(deps: RunnerDeps, trigger: Trigger): Promise<void> {
  const { db, now } = deps;
  const alertCtx = { db, now, notifier: deps.notifier };
  if (trigger === "github") {
    await resolveAlert(alertCtx, "trigger", "The hourly GitHub trigger is running again.");
    return;
  }
  if (trigger !== "vercel-cron") return;
  const [row] = await db
    .select({ at: max(events.at) })
    .from(events)
    .where(and(eq(events.type, "run"), sql`${events.data}->>'trigger' = 'github'`));
  const last = row?.at ? new Date(row.at) : null;
  if (!last || now.getTime() - last.getTime() > GITHUB_TRIGGER_STALE_MS) {
    await raiseAlert(
      alertCtx,
      "trigger",
      `The hourly GitHub trigger has not run ${last ? `since ${last.toISOString().slice(0, 16).replace("T", " ")} UTC` : "yet"}. ` +
        "Check GitHub → Actions → DISPATCH (GitHub pauses scheduled workflows after 60 days without commits) and that CRON_SECRET is set as a repo secret."
    );
  } else {
    await resolveAlert(alertCtx, "trigger");
  }
}

/** Recent events, newest first, for the admin. */
export async function recentEvents(deps: Pick<RunnerDeps, "db">, limit = 50) {
  return deps.db.select().from(events).orderBy(desc(events.at), desc(events.id)).limit(limit);
}
