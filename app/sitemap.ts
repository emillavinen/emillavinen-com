import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/mdx";
import { SITE_URL } from "@/lib/constants";

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

  return { priority: Math.min(0.95, Math.max(0.1, priority)), changeFrequency };
}

export default function sitemap(): MetadataRoute.Sitemap {
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
    { url: `${SITE_URL}/about`,  lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    ...posts,
  ];
}
