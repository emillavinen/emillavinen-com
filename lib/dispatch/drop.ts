import { isPlatform, type Platform } from "./config";

/**
 * Validation for the drop page. The browser uploads 1–4 images straight to
 * Blob under uploads/, then posts their URLs with the fields; the server
 * only accepts URLs in its own Blob store, so it can never be pointed at
 * another host.
 */

export interface DropInput {
  uploads: { url: string; name: string }[];
  title: string;
  caption: string;
  client: string | null;
  tools: string[];
  year: number | null;
  tags: string[];
  platforms: Platform[];
}

export const MAX_DROP_IMAGES = 4;

export function isOwnUpload(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.startsWith("/uploads/");
  } catch {
    return false;
  }
}

/** "Figma, Photoshop ,  " → ["Figma", "Photoshop"] */
export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitList);
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((v) => v.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseDropInput(body: unknown, now = new Date()): DropInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const uploads = Array.isArray(b.uploads) ? b.uploads : [];
  if (uploads.length < 1) return { error: "Add at least one image." };
  if (uploads.length > MAX_DROP_IMAGES) return { error: `At most ${MAX_DROP_IMAGES} images.` };
  const parsed: { url: string; name: string }[] = [];
  for (const u of uploads) {
    const url = typeof (u as { url?: unknown })?.url === "string" ? (u as { url: string }).url : "";
    if (!isOwnUpload(url)) return { error: "Upload URL is not in this site's Blob store." };
    const name = typeof (u as { name?: unknown }).name === "string" ? (u as { name: string }).name : "";
    parsed.push({ url, name: name.slice(0, 200) });
  }
  let year: number | null = null;
  if (b.year !== undefined && b.year !== null && String(b.year).trim() !== "") {
    const y = Number(String(b.year).trim());
    if (!Number.isInteger(y) || y < 1900 || y > now.getUTCFullYear() + 1) return { error: "Year looks wrong." };
    year = y;
  }
  const platforms = (Array.isArray(b.platforms) ? b.platforms : []).filter(isPlatform);
  return {
    uploads: parsed,
    title: text(b.title, 200),
    caption: text(b.caption, 5000),
    client: text(b.client, 200) || null,
    tools: splitList(b.tools).slice(0, 20),
    year,
    tags: splitList(b.tags).slice(0, 30),
    platforms,
  };
}
