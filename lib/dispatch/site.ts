import { getDb } from "./db/client";
import { getVisibleWork, listVisibleWorks, type WorkWithAssets } from "./works";

/**
 * Read side for the public site. Without a store the gallery is simply
 * empty. A failed read during `next build` is logged and rendered empty so
 * a database hiccup never fails a deploy; at runtime it throws, which makes
 * Next keep serving the previous version of the page.
 */

export interface GalleryImage {
  thumbUrl: string;
  displayUrl: string;
  socialUrl: string;
  width: number;
  height: number;
  alt: string;
}

export interface GalleryWork {
  id: string;
  slug: string;
  title: string;
  caption: string;
  client: string | null;
  tools: string[];
  tags: string[];
  year: number | null;
  createdAt: Date;
  images: GalleryImage[];
}

function toGallery(w: WorkWithAssets): GalleryWork {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    caption: w.caption,
    client: w.client,
    tools: w.tools,
    tags: w.tags,
    year: w.year,
    createdAt: w.createdAt,
    images: w.assets.map((a) => ({
      thumbUrl: a.thumbUrl,
      displayUrl: a.displayUrl,
      socialUrl: a.socialUrl,
      width: a.width,
      height: a.height,
      alt: a.alt || w.title,
    })),
  };
}

const isBuild = () => process.env.NEXT_PHASE === "phase-production-build";

async function safely<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isBuild()) throw err;
    console.error("[dispatch] store unreachable during build — rendering without it", err);
    return fallback;
  }
}

export async function getGalleryWorks(): Promise<GalleryWork[]> {
  const db = await getDb();
  if (!db) return [];
  return safely([], async () => (await listVisibleWorks(db)).map(toGallery));
}

export async function getGalleryWork(slug: string): Promise<GalleryWork | null> {
  const db = await getDb();
  if (!db) return null;
  return safely(null, async () => {
    const work = await getVisibleWork(db, slug);
    return work ? toGallery(work) : null;
  });
}

/** The year to show: the work's own, or the year it was added. */
export function displayYear(work: Pick<GalleryWork, "year" | "createdAt">): string {
  return String(work.year ?? work.createdAt.getUTCFullYear());
}

/** Approximate size of the `social` JPEG (2048 px long edge, never enlarged). */
export function socialSize(image: Pick<GalleryImage, "width" | "height">): { width: number; height: number } {
  const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
  return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
}

/**
 * Masonry by shortest column: each item, in order, goes to the column that
 * is currently shortest. Computed on the server from the stored aspect
 * ratios, so the browser lays the grid out once and nothing moves.
 */
export function masonry<T>(items: T[], columns: number, ratio: (item: T) => number, captionRatio = 0.08): T[][] {
  const cols: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  for (const item of items) {
    let target = 0;
    for (let i = 1; i < columns; i++) if (heights[i] < heights[target] - 1e-9) target = i;
    cols[target].push(item);
    heights[target] += ratio(item) + captionRatio;
  }
  return cols;
}
