import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/mdx";
import { SITE_URL } from "@/lib/constants";
import { getGalleryWorks } from "@/lib/dispatch/site";

function scorePost(wordCount: number, tagCount: number, daysSince: number): { priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] } {
  let priority = 0.5;
  if (wordCount > 1500) priority += 0.15;
  else if (wordCount > 800) priority += 0.1;
  if (tagCount >= 5) priority += 0.05;
  if (daysSince < 30) priority += 0.1;
  else if (daysSince > 365) priority -= 0.1;

  const changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] =
    daysSince < 7 ? "daily" :
    daysSince < 30 ? "weekly" :
    daysSince < 180 ? "monthly" : "yearly";

  return { priority: Math.round(Math.min(0.95, Math.max(0.1, priority)) * 100) / 100, changeFrequency };
}

// Regenerated hourly (and whenever DISPATCH adds a work) so new work pages
// appear without a deploy.
export const revalidate = 3600;

async function workEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const works = await getGalleryWorks();
    return works.map((work) => ({
      url: `${SITE_URL}/work/${work.slug}`,
      lastModified: work.createdAt,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error("[dispatch] sitemap: could not list works", err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = getAllPosts().map((post) => {
    const wordCount = post.content.trim().split(/\s+/).filter(Boolean).length;
    const daysSince = Math.floor((Date.now() - new Date(post.date).getTime()) / 86400000);
    const { priority, changeFrequency } = scorePost(wordCount, post.tags.length, daysSince);

    return {
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency,
      priority,
    };
  });

  return [
    { url: SITE_URL,             lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/blog`,   lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/work`,   lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    ...posts,
    ...(await workEntries()),
  ];
}
