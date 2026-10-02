import { siteUrl, type Platform } from "../config";

/**
 * Text templates. No AI: each platform's text is assembled from the work's
 * own fields, empty fields leave no trace (no blank lines, stray "·", or
 * "undefined"), and anything too long is shortened at a word boundary.
 */

export interface FormatFields {
  title: string;
  caption: string;
  client: string | null;
  tools: string[];
  tags: string[];
  year: number | null;
}

export function utmLink(slug: string, platform: Platform): string {
  const params = new URLSearchParams({ utm_source: platform, utm_medium: "social", utm_campaign: "dispatch" });
  return `${siteUrl()}/work/${encodeURIComponent(slug)}?${params.toString()}`;
}

export function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Joins the non-empty pieces with `sep`. */
export function joinPresent(pieces: (string | null | undefined)[], sep: string): string {
  return pieces.map(clean).filter(Boolean).join(sep);
}

/** "Client · Tool, Tool" — or whichever half exists. */
export function creditsLine(fields: Pick<FormatFields, "client" | "tools">): string {
  return joinPresent([fields.client, fields.tools.map(clean).filter(Boolean).join(", ")], " · ");
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

export const graphemeLength = (text: string) => graphemes(text).length;

/** Cuts `text` so measure(text) ≤ limit, at a word boundary when one is close, ending in "…". */
export function truncate(text: string, limit: number, measure: (t: string) => number = graphemeLength): string {
  if (measure(text) <= limit) return text;
  const chars = graphemes(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(chars.slice(0, mid).join("").trimEnd() + "…") <= limit) lo = mid;
    else hi = mid - 1;
  }
  let cut = chars.slice(0, lo).join("");
  const space = cut.search(/\s\S*$/);
  if (space > cut.length * 0.6) cut = cut.slice(0, space);
  cut = cut.replace(/[\s,.;:·–—-]+$/, "");
  return cut ? `${cut}…` : "";
}

/**
 * Builds "head\n\nbody\n\ntail" within `limit`: the tail (usually the link)
 * is kept whole, the body gives way first, then the head.
 */
export function fitBlocks(
  { head, body, tail }: { head: string; body?: string; tail?: string },
  limit: number,
  measure: (t: string) => number = graphemeLength,
  sep = "\n\n"
): string {
  const h = clean(head);
  const b = clean(body);
  const t = clean(tail);
  const assemble = (hh: string, bb: string) => joinPresent([hh, bb, t], sep);
  const full = assemble(h, b);
  if (measure(full) <= limit) return full;
  if (b) {
    const withoutBody = assemble(h, "");
    const room = limit - measure(withoutBody) - measure(sep);
    if (room > 12) {
      const shortened = truncate(b, room, measure);
      const candidate = assemble(h, shortened);
      if (shortened && measure(candidate) <= limit) return candidate;
    }
    if (measure(withoutBody) <= limit) return withoutBody;
  }
  const room = limit - (t ? measure(t) + measure(sep) : 0);
  return assemble(truncate(h, Math.max(room, 1), measure), "");
}
