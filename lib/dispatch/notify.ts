import { and, eq, isNull, lt, or } from "drizzle-orm";
import { env, logOnce } from "./config";
import type { Db } from "./db/client";
import { alerts } from "./db/schema";
import { logEvent } from "./store";

/**
 * Notifications go to Telegram, or to email through Resend when Telegram is
 * not set, or only to the log when neither is. Messages are short and plain.
 */

export interface Notifier {
  /** Returns whether a message left the building (false = log only or failed). */
  send(text: string): Promise<boolean>;
}

export function defaultNotifier(fetchImpl: typeof fetch = fetch): Notifier {
  return {
    async send(text) {
      const telegramToken = env("TELEGRAM_BOT_TOKEN");
      const telegramChat = env("TELEGRAM_CHAT_ID");
      try {
        if (telegramToken && telegramChat) {
          const res = await fetchImpl(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // The bot may be shared with other projects: say who is talking.
            body: JSON.stringify({ chat_id: telegramChat, text: `DISPATCH — ${text}`.slice(0, 4000), disable_web_page_preview: true }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) console.error(`[dispatch] telegram ${res.status}: ${await res.text().catch(() => "")}`);
          return res.ok;
        }
        const resendKey = env("RESEND_API_KEY");
        const to = env("NOTIFY_EMAIL");
        if (resendKey && to) {
          const res = await fetchImpl("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: env("NOTIFY_FROM") ?? "DISPATCH <onboarding@resend.dev>",
              to: [to],
              subject: `DISPATCH: ${text.split("\n")[0].slice(0, 90)}`,
              text,
            }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) console.error(`[dispatch] resend ${res.status}: ${await res.text().catch(() => "")}`);
          return res.ok;
        }
      } catch (err) {
        console.error("[dispatch] notification failed", err);
        return false;
      }
      logOnce("no-notify", "Neither Telegram nor Resend is configured — notifications go to the log only.");
      console.info(`[dispatch] notify:\n${text}`);
      return false;
    },
  };
}

export interface AlertCtx {
  db: Db;
  now: Date;
  notifier: Notifier;
}

const DAY = 86_400_000;

/** Every alert that goes out is also written to the event log. */
async function sendAlert(ctx: AlertCtx, key: string, kind: "alert" | "alert_reminder" | "alert_resolved" | "notice", message: string): Promise<void> {
  await ctx.notifier.send(message);
  await logEvent(ctx.db, ctx.now, { type: kind, message, data: { key } });
}

/**
 * Alerts fire on change, not on every run: the first time a condition is
 * raised, one reminder a day while it stays active, and one line when it
 * clears. Each send is claimed with a conditional update first, so two
 * overlapping runs never send the same alert twice.
 */
export async function raiseAlert(ctx: AlertCtx, key: string, message: string): Promise<void> {
  const { db, now } = ctx;
  const inserted = await db
    .insert(alerts)
    .values({ key, message, active: true, firstAt: now, lastSentAt: now })
    .onConflictDoNothing()
    .returning({ key: alerts.key });
  if (inserted.length > 0) {
    await sendAlert(ctx, key, "alert", message);
    return;
  }
  const reactivated = await db
    .update(alerts)
    .set({ active: true, message, firstAt: now, lastSentAt: now, resolvedAt: null })
    .where(and(eq(alerts.key, key), eq(alerts.active, false)))
    .returning({ key: alerts.key });
  if (reactivated.length > 0) {
    await sendAlert(ctx, key, "alert", message);
    return;
  }
  await db.update(alerts).set({ message }).where(eq(alerts.key, key));
  await remindIfDue(ctx, key);
}

async function remindIfDue(ctx: AlertCtx, key: string): Promise<void> {
  const claimed = await ctx.db
    .update(alerts)
    .set({ lastSentAt: ctx.now })
    .where(
      and(
        eq(alerts.key, key),
        eq(alerts.active, true),
        or(isNull(alerts.lastSentAt), lt(alerts.lastSentAt, new Date(ctx.now.getTime() - DAY)))
      )
    )
    .returning({ message: alerts.message });
  if (claimed.length > 0) await sendAlert(ctx, key, "alert_reminder", `Still open: ${claimed[0].message}`);
}

export async function resolveAlert(ctx: AlertCtx, key: string, message?: string): Promise<void> {
  const resolved = await ctx.db
    .update(alerts)
    .set({ active: false, resolvedAt: ctx.now })
    .where(and(eq(alerts.key, key), eq(alerts.active, true)))
    .returning({ message: alerts.message });
  if (resolved.length > 0) {
    if (message) await sendAlert(ctx, key, "alert_resolved", message);
    else await logEvent(ctx.db, ctx.now, { type: "alert_resolved", message: resolved[0].message, data: { key } });
  }
}

/** A one-off notice that should never repeat (e.g. a pin that could not be imported). */
export async function notifyOnce(ctx: AlertCtx, key: string, message: string): Promise<void> {
  const inserted = await ctx.db
    .insert(alerts)
    .values({ key, message, active: false, firstAt: ctx.now, lastSentAt: ctx.now, resolvedAt: ctx.now })
    .onConflictDoNothing()
    .returning({ key: alerts.key });
  if (inserted.length > 0) await sendAlert(ctx, key, "notice", message);
}

/** One daily reminder for every alert still open, including ones no run re-raises. */
export async function sendDueReminders(ctx: AlertCtx): Promise<void> {
  const open = await ctx.db
    .select({ key: alerts.key })
    .from(alerts)
    .where(and(eq(alerts.active, true), lt(alerts.lastSentAt, new Date(ctx.now.getTime() - DAY))));
  for (const { key } of open) await remindIfDue(ctx, key);
}
