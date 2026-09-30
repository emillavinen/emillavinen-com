import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getGalleryWorks } from "@/lib/dispatch/site";

export const dynamic = "force-static";
export const revalidate = 3600;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const works = (await getGalleryWorks()).slice(0, 50);

  const items = works
    .map((work) => {
      const url = `${SITE_URL}/work/${work.slug}`;
      const cover = work.images[0];
      const tags = work.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("\n      ");
      return `
    <item>
      <title>${escapeXml(work.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${work.createdAt.toUTCString()}</pubDate>
      <description>${escapeXml(work.caption || work.title)}</description>
      ${tags}
      <media:content url="${escapeXml(cover.socialUrl)}" medium="image" type="image/jpeg" />
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)} — work</title>
    <link>${SITE_URL}/work</link>
    <description>New work by Emil Lavinen, designer in Helsinki.</description>
    <language>en</language>
    <lastBuildDate>${(works[0]?.createdAt ?? new Date()).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/work/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
