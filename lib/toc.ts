export interface TocItem {
  level: 2 | 3;
  text: string;
  slug: string;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length as 2 | 3;
    const text = match[2].replace(/\*\*|__|~~|\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
    items.push({ level, text, slug: toSlug(text) });
  }

  return items.length >= 3 ? items : [];
}
