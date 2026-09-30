import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { BlobStore } from "./blob";
import { PLATFORMS, type Platform } from "./config";
import { allStates } from "./credentials";
import type { Db } from "./db/client";
import { assets, deliveries, works, type Asset, type NewAsset, type PlatformStateRow, type Work, type WorkOrigin } from "./db/schema";
import { processImage, type ImageVariants } from "./images";
import { ADAPTERS } from "./platforms";
import { parseWindow, planDeliveries, type Rand } from "./schedule";

/**
 * Works: creating them from images, and putting them in (or holding them
 * back from) the dispatch queue. Inputs call these; the runner reads the
 * resulting deliveries.
 */

export interface WorkDeps {
  db: Db;
  now: Date;
  blob: BlobStore;
  rand: Rand;
  revalidate: (paths: string[]) => void;
}

export interface PlatformConfig {
  enabled: Platform[];
  states: Map<string, PlatformStateRow>;
}

/** Which platforms have what they need to post, from env and stored credentials. */
export async function platformConfig(db: Db): Promise<PlatformConfig> {
  const states = await allStates(db);
  return { enabled: PLATFORMS.filter((p) => ADAPTERS[p].configured(states.get(p))), states };
}

export function slugify(text: string): string {
  const base = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "work";
}

export async function uniqueSlug(db: Db, title: string): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (await db.select({ slug: works.slug }).from(works).where(or(eq(works.slug, base), like(works.slug, `${base}-%`)))).map((r) => r.slug)
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export function workPaths(slug?: string): string[] {
  return ["/work", "/work/rss.xml", "/sitemap.xml", ...(slug ? [`/work/${slug}`] : [])];
}

export interface NewWorkInput {
  title?: string | null;
  caption?: string | null;
  client?: string | null;
  tools?: string[];
  year?: number | null;
  tags?: string[];
  origin: WorkOrigin;
  sourceId?: string | null;
  sourceUrl?: string | null;
  createdAt?: Date;
  images: { buffer: Buffer; alt?: string }[];
  /** Used when title is empty. */
  fallbackTitle?: string;
}

export type QueueChoice = { mode: "held" } | { mode: "queue"; platforms?: Platform[] };

/** An existing work with the same source (a pin or file already imported under any origin). */
export async function findBySource(db: Db, sourceId: string): Promise<Work | undefined> {
  const rows = await db
    .select()
    .from(works)
    .where(and(eq(works.sourceId, sourceId), inArray(works.origin, ["pinterest", "import", "drop"])))
    .limit(1);
  return rows[0];
}

function cleanList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((v) => v.trim()).filter(Boolean)));
}

async function uploadVariants(blob: BlobStore, workId: string, position: number, v: ImageVariants) {
  const put = (name: keyof ImageVariants) =>
    blob.put(`works/${workId}/${position}-${name}.${v[name].ext}`, v[name].buffer, v[name].contentType);
  const [thumbUrl, displayUrl, socialUrl, bskyUrl] = await Promise.all([put("thumb"), put("display"), put("social"), put("bsky")]);
  return { thumbUrl, displayUrl, socialUrl, bskyUrl };
}

/**
 * Processes the images, stores the variants, and writes the work, its assets
 * and its deliveries. Idempotent on sourceId: a work that already exists is
 * returned untouched.
 */
export async function createWork(
  deps: WorkDeps,
  input: NewWorkInput,
  queue: QueueChoice
): Promise<{ work: Work; created: boolean }> {
  const { db, now, blob } = deps;
  if (input.sourceId) {
    const existing = await findBySource(db, input.sourceId);
    if (existing) return { work: existing, created: false };
  }
  if (input.images.length === 0) throw new Error("A work needs at least one image");

  const processed: ImageVariants[] = [];
  for (const image of input.images) processed.push(await processImage(image.buffer));

  const workId = crypto.randomUUID();
  const uploaded: string[] = [];
  const assetRows: NewAsset[] = [];
  try {
    for (const [position, variants] of processed.entries()) {
      const urls = await uploadVariants(blob, workId, position, variants);
      uploaded.push(urls.thumbUrl, urls.displayUrl, urls.socialUrl, urls.bskyUrl);
      assetRows.push({
        workId,
        position,
        ...urls,
        width: variants.display.width,
        height: variants.display.height,
        alt: (input.images[position].alt ?? "").trim(),
      });
    }
  } catch (err) {
    await blob.del(uploaded).catch(() => {});
    throw err;
  }

  const title = (input.title ?? "").trim() || (input.fallbackTitle ?? "").trim() || "Untitled";
  let inserted: Work[] = [];
  for (let attempt = 0; attempt < 3 && inserted.length === 0; attempt++) {
    const slug = attempt === 0 ? await uniqueSlug(db, title) : `${slugify(title)}-${Math.floor(deps.rand() * 1e6).toString(36)}`;
    try {
      inserted = await db
        .insert(works)
        .values({
          id: workId,
          slug,
          title,
          caption: (input.caption ?? "").trim(),
          client: input.client?.trim() || null,
          tools: cleanList(input.tools),
          year: input.year ?? null,
          tags: cleanList(input.tags),
          origin: input.origin,
          sourceId: input.sourceId ?? null,
          sourceUrl: input.sourceUrl ?? null,
          createdAt: input.createdAt ?? now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: [works.origin, works.sourceId] })
        .returning();
      if (inserted.length === 0) {
        // Another run created this source between our check and insert.
        await blob.del(uploaded).catch(() => {});
        const existing = input.sourceId ? await findBySource(db, input.sourceId) : undefined;
        if (existing) return { work: existing, created: false };
        throw new Error("Work insert was skipped without a matching source");
      }
    } catch (err) {
      if (!String((err as { cause?: unknown })?.cause ?? err).includes("works_slug_key") && !String(err).includes("works_slug_key")) {
        await blob.del(uploaded).catch(() => {});
        throw err;
      }
      // Slug taken by a concurrent insert: try again with a suffix.
    }
  }
  if (inserted.length === 0) {
    await blob.del(uploaded).catch(() => {});
    throw new Error("Could not find a free slug for this work");
  }
  const work = inserted[0];
  await db.insert(assets).values(assetRows);

  if (queue.mode === "held") await holdWork(deps, work.id);
  else await queueWork(deps, work.id, queue.platforms);

  deps.revalidate(workPaths(work.slug));
  return { work, created: true };
}

/** Backlog: held deliveries for every enabled platform, never scheduled. */
export async function holdWork(deps: Pick<WorkDeps, "db" | "now">, workId: string): Promise<void> {
  const { enabled } = await platformConfig(deps.db);
  if (enabled.length === 0) return;
  await deps.db
    .insert(deliveries)
    .values(enabled.map((platform) => ({ workId, platform, status: "held" as const, createdAt: deps.now, updatedAt: deps.now })))
    .onConflictDoNothing();
}

/**
 * Puts a new work in the queue: a pending delivery per selected, enabled
 * platform on the staggered plan; `skipped` for platforms Emil unticked or
 * that are not connected (the latter become `held` if the platform is
 * connected later).
 */
export async function queueWork(deps: Pick<WorkDeps, "db" | "now" | "rand">, workId: string, selected?: Platform[]): Promise<void> {
  const { db, now } = deps;
  const { enabled } = await platformConfig(db);
  const wanted = enabled.filter((p) => !selected || selected.includes(p));
  const plan = planDeliveries(wanted, now, parseWindow(), deps.rand);
  const rows = PLATFORMS.map((platform) => {
    const planned = plan.find((p) => p.platform === platform);
    if (planned) return { workId, platform, status: "pending" as const, notBefore: planned.notBefore, createdAt: now, updatedAt: now };
    return {
      workId,
      platform,
      status: "skipped" as const,
      skipReason: enabled.includes(platform) ? "deselected" : "disabled",
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.insert(deliveries).values(rows).onConflictDoNothing();
  await db.update(works).set({ queuedAt: now, summarySentAt: null, summaryClaimedAt: null, updatedAt: now }).where(eq(works.id, workId));
}

/**
 * Moves a work's held deliveries into the queue (the backlog drip). Each row
 * moves with a conditional update, so overlapping runs cannot double-queue.
 * Returns how many deliveries were queued.
 */
export async function releaseHeld(deps: Pick<WorkDeps, "db" | "now" | "rand">, workId: string, platforms: Platform[]): Promise<number> {
  const { db, now } = deps;
  const held = await db
    .select({ id: deliveries.id, platform: deliveries.platform })
    .from(deliveries)
    .where(and(eq(deliveries.workId, workId), eq(deliveries.status, "held"), inArray(deliveries.platform, platforms)));
  if (held.length === 0) return 0;
  const plan = planDeliveries(held.map((h) => h.platform as Platform), now, parseWindow(), deps.rand);
  let moved = 0;
  for (const row of held) {
    const at = plan.find((p) => p.platform === row.platform)!.notBefore;
    const res = await db
      .update(deliveries)
      .set({ status: "pending", notBefore: at, attempts: 0, lastError: null, updatedAt: now })
      .where(and(eq(deliveries.id, row.id), eq(deliveries.status, "held")))
      .returning({ id: deliveries.id });
    moved += res.length;
  }
  if (moved > 0) {
    await db.update(works).set({ queuedAt: now, summarySentAt: null, summaryClaimedAt: null, updatedAt: now }).where(eq(works.id, workId));
  }
  return moved;
}

/**
 * A platform that became enabled gets `held` deliveries for every existing
 * work — backlog, never pending, so connecting a platform never floods it.
 */
export async function backfillHeld(db: Db, platform: Platform, now: Date): Promise<void> {
  await db
    .update(deliveries)
    .set({ status: "held", skipReason: null, updatedAt: now })
    .where(and(eq(deliveries.platform, platform), eq(deliveries.status, "skipped"), eq(deliveries.skipReason, "disabled")));
  await db.execute(sql`
    INSERT INTO deliveries (id, work_id, platform, status, attempts, created_at, updated_at)
    SELECT gen_random_uuid(), w.id, ${platform}, 'held', 0, ${now}, ${now}
    FROM works w
    WHERE NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.work_id = w.id AND d.platform = ${platform})
    ON CONFLICT DO NOTHING
  `);
}

// ── Reads for the site ─────────────────────────────────────────────────────

export interface WorkWithAssets extends Work {
  assets: Asset[];
}

async function attachAssets(db: Db, rows: Work[]): Promise<WorkWithAssets[]> {
  if (rows.length === 0) return [];
  const all = await db
    .select()
    .from(assets)
    .where(inArray(assets.workId, rows.map((r) => r.id)))
    .orderBy(asc(assets.position));
  const byWork = new Map<string, Asset[]>();
  for (const a of all) byWork.set(a.workId, [...(byWork.get(a.workId) ?? []), a]);
  return rows.map((r) => ({ ...r, assets: byWork.get(r.id) ?? [] }));
}

export async function listVisibleWorks(db: Db, limit = 1000): Promise<WorkWithAssets[]> {
  const rows = await db
    .select()
    .from(works)
    .where(eq(works.visibleOnSite, true))
    .orderBy(desc(works.createdAt), desc(works.id))
    .limit(limit);
  return (await attachAssets(db, rows)).filter((w) => w.assets.length > 0);
}

export async function getVisibleWork(db: Db, slug: string): Promise<WorkWithAssets | null> {
  const rows = await db
    .select()
    .from(works)
    .where(and(eq(works.slug, slug), eq(works.visibleOnSite, true)))
    .limit(1);
  const [work] = await attachAssets(db, rows);
  return work && work.assets.length > 0 ? work : null;
}

export async function getWorkById(db: Db, id: string): Promise<WorkWithAssets | null> {
  const rows = await db.select().from(works).where(eq(works.id, id)).limit(1);
  const [work] = await attachAssets(db, rows);
  return work ?? null;
}

export async function listAllWorks(db: Db, limit = 500): Promise<Work[]> {
  return db.select().from(works).orderBy(desc(works.createdAt)).limit(limit);
}

export async function deliveriesFor(db: Db, workIds: string[]) {
  if (workIds.length === 0) return [];
  return db.select().from(deliveries).where(inArray(deliveries.workId, workIds));
}

