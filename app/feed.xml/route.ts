import { getAllPosts } from "@/lib/mdx";
import { SITE_URL, AUTHOR_EMAIL, SITE_NAME } from "@/lib/constants";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRFC822(dateStr: string): string {
  return new Date(dateStr).toUTCString();
}

export async function GET() {
  const posts = getAllPosts();
  const buildDate = new Date().toUTCString();

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      const excerpt = String((post as unknown as Record<string, unknown>).excerpt ?? post.description ?? "");
      const tagsXml = post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("\n      ");

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <description>${escapeXml(excerpt || post.description)}</description>
      <author>${AUTHOR_EMAIL} (${SITE_NAME})</author>
      ${tagsXml}
      <pubDate>${toRFC822(post.date)}</pubDate>
      <guid isPermaLink="true">${url}</guid>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>Essays on brand strategy, creative direction, visual identity, and culture by Emil Lavinen.</description>
    <language>en-gb</language>
    <copyright>Copyright ${new Date().getFullYear()} ${SITE_NAME}</copyright>
    <managingEditor>${AUTHOR_EMAIL} (${SITE_NAME})</managingEditor>
    <webMaster>${AUTHOR_EMAIL} (${SITE_NAME})</webMaster>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <category>Brand Strategy</category>
    <category>Creative Direction</category>
    <generator>emillavinen.com</generator>
    <image>
      <url>${SITE_URL}/icons/favicon-32x32.png</url>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${SITE_URL}</link>
    </image>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
