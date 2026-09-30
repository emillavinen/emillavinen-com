import { XMLParser } from "fast-xml-parser";

/**
 * Pinterest board RSS. Undocumented: a public board serves roughly its
 * latest 25 pins at the board URL plus `.rss`. Each item's link carries the
 * pin id and its description holds `<a><img src="…/236x/…"></a>text`, where
 * the text is HTML-escaped a second time inside the XML-escaped description.
 */

export interface FeedItem {
  pinId: string;
  link: string;
  title: string;
  description: string;
  imageUrl: string;
  pubDate: Date | null;
}

export interface Feed {
  title: string;
  items: FeedItem[];
}

export class FeedFormatError extends Error {}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED[body.toLowerCase()] ?? match;
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const parser = new XMLParser({
  ignoreAttributes: true,
  processEntities: true,
  htmlEntities: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "item",
});

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return String((value as { "#text": unknown })["#text"]);
  return "";
}

export function parseFeed(xml: string): Feed {
  if (!/<rss[\s>]/i.test(xml)) throw new FeedFormatError("Response is not an RSS feed");
  let doc: { rss?: { channel?: { title?: unknown; item?: unknown[] } } };
  try {
    doc = parser.parse(xml);
  } catch (err) {
    throw new FeedFormatError(`Feed XML could not be parsed: ${err instanceof Error ? err.message : err}`);
  }
  const channel = doc?.rss?.channel;
  if (!channel) throw new FeedFormatError("Feed has no channel");
  const items: FeedItem[] = [];
  for (const raw of channel.item ?? []) {
    const item = raw as Record<string, unknown>;
    const link = str(item.link) || str(item.guid);
    const pinId = link.match(/\/pin\/(\d+)/)?.[1];
    const html = str(item.description);
    const imageUrl = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    if (!pinId || !imageUrl) continue;
    const pub = Date.parse(str(item.pubDate));
    items.push({
      pinId,
      link: `https://www.pinterest.com/pin/${pinId}/`,
      title: tidy(decodeEntities(str(item.title))),
      description: tidy(decodeEntities(stripTags(html.replace(/<a[^>]*>\s*<img[^>]*>\s*<\/a>/i, "")))),
      imageUrl: decodeEntities(imageUrl),
      pubDate: Number.isFinite(pub) ? new Date(pub) : null,
    });
  }
  if ((channel.item ?? []).length > 0 && items.length === 0) {
    throw new FeedFormatError("Feed items no longer carry a pin link and image — the feed format changed");
  }
  return { title: tidy(decodeEntities(str(channel.title))), items };
}

/** Full-size first: `originals`, then `1200x`, then `736x`, then the URL as given. */
export function imageCandidates(url: string): string[] {
  const match = url.match(/^(https?:\/\/i\.pinimg\.com\/)([^/]+)(\/.+)$/);
  if (!match) return [url];
  const [, host, , rest] = match;
  const out = ["originals", "1200x", "736x"].map((size) => `${host}${size}${rest}`);
  if (!out.includes(url)) out.push(url);
  return out;
}

/** `https://www.pinterest.com/<user>/<board>` from anything Emil might paste. */
export function normalizeBoardUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  if (!/(^|\.)pinterest\.[a-z.]+$/i.test(url.hostname)) return null;
  const parts = url.pathname.replace(/\.rss$/i, "").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return `https://www.pinterest.com/${parts[0]}/${parts[1]}`;
}

export function boardFeedUrl(board: string): string {
  return `${board}.rss`;
}
