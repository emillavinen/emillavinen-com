import type { Sharp } from "sharp";

/**
 * Every image is processed once, on ingest, into four variants. Each is
 * rotated upright from its EXIF orientation, converted to sRGB (sources can
 * be CMYK or Adobe RGB), flattened onto white, and written with no metadata
 * at all — sharp drops EXIF, GPS, XMP and ICC unless asked to keep them.
 * Originals are never stored.
 */

export type VariantName = "thumb" | "display" | "social" | "bsky";

export interface Variant {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/webp" | "image/jpeg";
  ext: "webp" | "jpg";
}

export type ImageVariants = Record<VariantName, Variant>;

export const SOCIAL_MAX_BYTES = 4.5 * 1024 * 1024;
/** Bluesky rejects blobs around 1 MB; stay clear of it. */
export const BSKY_MAX_BYTES = 950 * 1000;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "tiff", "avif"]);

export class UnsupportedImageError extends Error {}

async function loadSharp() {
  return (await import("sharp")).default;
}

function toVariant(data: Buffer, info: { width: number; height: number }, kind: "webp" | "jpeg"): Variant {
  return {
    buffer: data,
    width: info.width,
    height: info.height,
    contentType: kind === "webp" ? "image/webp" : "image/jpeg",
    ext: kind === "webp" ? "webp" : "jpg",
  };
}

async function jpegUnder(base: Sharp, longEdge: number, maxBytes: number, qualities: number[]): Promise<Variant> {
  let edge = longEdge;
  for (let round = 0; round < 12; round++) {
    for (const quality of qualities) {
      const { data, info } = await base
        .clone()
        .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= maxBytes) return toVariant(data, info, "jpeg");
    }
    // Quality alone was not enough: shrink and try again.
    edge = Math.floor(edge * 0.85);
  }
  throw new UnsupportedImageError("Image could not be compressed under the size limit");
}

export async function processImage(input: Buffer): Promise<ImageVariants> {
  const sharp = await loadSharp();
  let meta;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new UnsupportedImageError("That file is not an image DISPATCH can read");
  }
  if (meta.format === "heif") {
    throw new UnsupportedImageError("HEIC images are not supported — export as JPEG, PNG or WebP");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new UnsupportedImageError(`Unsupported image format: ${meta.format ?? "unknown"}`);
  }

  const base = sharp(input, { failOn: "error", animated: false })
    .rotate()
    .toColourspace("srgb")
    .flatten({ background: "#ffffff" });

  const thumb = await base
    .clone()
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const display = await base
    .clone()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  const social = await jpegUnder(base, 2048, SOCIAL_MAX_BYTES, [88, 80, 72, 64]);
  const bsky = await jpegUnder(base, 2048, BSKY_MAX_BYTES, [85, 78, 70, 62, 55]);

  return {
    thumb: toVariant(thumb.data, thumb.info, "webp"),
    display: toVariant(display.data, display.info, "webp"),
    social,
    bsky,
  };
}

/** Title from a file name: "IMG_2041-final_v2.jpg" → "IMG 2041 final v2". */
export function titleFromFileName(name: string): string {
  const stem = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const cleaned = stem.replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "Untitled";
}
