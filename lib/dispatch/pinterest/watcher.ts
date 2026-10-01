import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { fetchBytes } from "../blob";
import { pinterestBoards } from "../config";
import { feedItems, pinterestBoards as boardsTable } from "../db/schema";
import { UnsupportedImageError } from "../images";
import { notifyOnce, raiseAlert, resolveAlert, type Notifier } from "../notify";
import { logEvent } from "../store";
import { truncate } from "../platforms/format";
import { createWork, findBySource, type WorkDeps } from "../works";
import { boardFeedUrl, imageCandidates, normalizeBoardUrl, parseFeed } from "./feed";

/**
 * The Pinterest board watcher, the main input. Reads only the boards in
 * PINTEREST_BOARDS (never the profile feed, which mixes in other people's
 * pins). Every pin seen on a board's first successful read is baseline:
 * it becomes a work on the site with `held` deliveries and is never
 * dispatched. Pins that appear after that are queued.
 *
 * Fetching and processing are separate: feed items are recorded first, then
 * processed one by one within the run's time budget, each claimed with a
 * conditional update so overlapping runs never ingest the same pin twice.
 */

export interface WatcherDeps extends WorkDeps {
  fetch: typeof fetch;
  notifier: Notifier;
}

const USER_AGENT = "Mozilla/5.0 (compatible; DISPATCH/1.0; +https://emillavinen.com)";
const MAX_ATTEMPTS = 5;
const CLAIM_MS = 10 * 60_000;

export async function readBoards(deps: WatcherDeps): Promise<{ boards: number; newItems: number }> {
  const { db, now } = deps;
  const alertCtx = { db, now, notifier: deps.notifier };
  let newItems = 0;
  const boards = pinterestBoards();
  for (const raw of boards) {
    const board = normalizeBoardUrl(raw);
    if (!board) {
      await raiseAlert(alertCtx, `feed:${raw}`, `PINTEREST_BOARDS has an entry that is not a board URL: ${raw}`);
      continue;
    }
    let feed;
    try {
      const res = await deps.fetch(boardFeedUrl(board), {
        headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.5" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      feed = parseFeed(await res.text());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .insert(boardsTable)
        .values({ url: board, lastError: message, updatedAt: now })
        .onConflictDoUpdate({ target: boardsTable.url, set: { lastError: message, updatedAt: now } });
      await logEvent(db, now, { type: "feed_error", message: `${board}: ${message}` });
      await raiseAlert(
        alertCtx,
        `feed:${board}`,
        `Pinterest feed broke: ${board} (${message}). DISPATCH retries every run; everything else keeps working.`
      );
      continue;
    }
    await resolveAlert(alertCtx, `feed:${board}`, `Pinterest feed works again: ${board}`);

    await db.insert(boardsTable).values({ url: board, title: feed.title, updatedAt: now }).onConflictDoNothing();
    const [row] = await db.select().from(boardsTable).where(eq(boardsTable.url, board));
    const baseline = !row?.baselinedAt;

    for (const item of feed.items) {
      const inserted = await db
        .insert(feedItems)
        .values({
          pinId: item.pinId,
          boardUrl: board,
          boardTitle: feed.title,
          isBaseline: baseline,
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl,
          link: item.link,
          pubDate: item.pubDate,
          firstSeenAt: now,
        })
        .onConflictDoNothing()
        .returning({ pinId: feedItems.pinId });
      if (inserted.length > 0 && !baseline) newItems++;
    }

    if (baseline) {
      const set = await db
        .update(boardsTable)
        .set({ baselinedAt: now })
        .where(and(eq(boardsTable.url, board), isNull(boardsTable.baselinedAt)))
        .returning({ url: boardsTable.url });
      if (set.length > 0) {
        await logEvent(db, now, { type: "pinterest_baseline", message: `${board}: ${feed.items.length} pins recorded as baseline (shown on site, never dispatched)` });
      }
    }
    await db.update(boardsTable).set({ title: feed.title, lastOkAt: now, lastError: null, updatedAt: now }).where(eq(boardsTable.url, board));
  }
  return { boards: boards.length, newItems };
}

const MAX_TITLE = 90;

/**
 * Title and caption from a pin. A blank title falls back to the first
 * sentence of the description, then the board's name. Pin titles that are
 * really paragraphs are shortened, and the full text becomes the caption
 * when the pin has none.
 */
export function titleAndCaption(item: { title: string; description: string; boardTitle: string | null }): {
  title: string;
  fallback: string;
  caption: string;
} {
  let title = item.title.trim();
  let caption = item.description && item.description !== title ? item.description.trim() : "";
  if (title.length > MAX_TITLE) {
    if (!caption) caption = title;
    title = truncate(title, MAX_TITLE);
  }
  const firstSentence = item.description.split(/(?<=[.!?])\s|\n/)[0]?.trim() ?? "";
  return {
    title,
    fallback: (firstSentence.length > MAX_TITLE ? truncate(firstSentence, MAX_TITLE) : firstSentence) || item.boardTitle || "Untitled",
    caption,
  };
}

async function downloadPinImage(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  let lastError: unknown;
  for (const candidate of imageCandidates(url)) {
    try {
      const { buffer, contentType } = await fetchBytes(candidate, fetchImpl, { timeoutMs: 20_000 });
      if (contentType && !contentType.startsWith("image/")) throw new Error(`${candidate} is ${contentType}`);
      return buffer;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No image size could be downloaded");
}

/** Turns recorded feed items into works until the deadline. Returns how many were processed. */
export async function processFeedItems(deps: WatcherDeps, deadline: number): Promise<number> {
  const { db, now } = deps;
  let processed = 0;
  for (let guard = 0; guard < 50 && Date.now() < deadline; guard++) {
    const staleClaim = new Date(now.getTime() - CLAIM_MS);
    const [next] = await db
      .select()
      .from(feedItems)
      .where(and(isNull(feedItems.processedAt), lt(feedItems.attempts, MAX_ATTEMPTS), or(isNull(feedItems.claimedAt), lt(feedItems.claimedAt, staleClaim))))
      // New pins before the baseline backlog, oldest first within each.
      .orderBy(asc(feedItems.isBaseline), asc(feedItems.pubDate), asc(feedItems.firstSeenAt))
      .limit(1);
    if (!next) break;
    const claimed = await db
      .update(feedItems)
      .set({ claimedAt: now })
      .where(and(eq(feedItems.pinId, next.pinId), isNull(feedItems.processedAt), or(isNull(feedItems.claimedAt), lt(feedItems.claimedAt, staleClaim))))
      .returning({ pinId: feedItems.pinId });
    if (claimed.length === 0) continue;

    try {
      const existing = await findBySource(db, next.pinId);
      let workId = existing?.id;
      if (!existing) {
        const buffer = await downloadPinImage(next.imageUrl, deps.fetch);
        const { title, fallback, caption } = titleAndCaption(next);
        const { work } = await createWork(
          deps,
          {
            origin: "pinterest",
            sourceId: next.pinId,
            sourceUrl: next.link,
            title,
            fallbackTitle: fallback,
            caption,
            createdAt: next.pubDate ?? now,
            images: [{ buffer, alt: title || caption || fallback }],
          },
          next.isBaseline ? { mode: "held" } : { mode: "queue" }
        );
        workId = work.id;
        await logEvent(db, now, {
          type: next.isBaseline ? "work_baseline" : "work_new",
          workId,
          message: `${work.title} (${next.link})`,
        });
      }
      await db.update(feedItems).set({ processedAt: now, workId: workId ?? null, claimedAt: null, lastError: null }).where(eq(feedItems.pinId, next.pinId));
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = next.attempts + 1;
      const giveUp = attempts >= MAX_ATTEMPTS || err instanceof UnsupportedImageError;
      await db
        .update(feedItems)
        .set({ attempts: giveUp ? MAX_ATTEMPTS : attempts, lastError: message, claimedAt: null })
        .where(eq(feedItems.pinId, next.pinId));
      await logEvent(db, now, { type: "pin_error", message: `${next.link}: ${message}` });
      if (giveUp) {
        await notifyOnce({ db, now, notifier: deps.notifier }, `pin:${next.pinId}`, `Could not import pin ${next.link}: ${message}`);
      }
    }
  }
  return processed;
}
