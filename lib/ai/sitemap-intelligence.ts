import OpenAI from "openai";
import type { Post } from "@/lib/mdx";

export interface SitemapSignals {
  wordCount: number;
  tagCount: number;
  hasExcerpt: boolean;
  daysSinceUpdate: number;
}

export interface SitemapPriority {
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
}

function buildSignals(post: Post): SitemapSignals {
  const wordCount = post.content.trim().split(/\s+/).filter(Boolean).length;
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(post.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    wordCount,
    tagCount: post.tags.length,
    hasExcerpt: Boolean((post as unknown as Record<string, unknown>).excerpt),
    daysSinceUpdate,
  };
}

function heuristicPriority(signals: SitemapSignals): SitemapPriority {
  let priority = 0.5;
  if (signals.wordCount > 1500) priority += 0.15;
  else if (signals.wordCount > 800) priority += 0.1;
  if (signals.tagCount >= 5) priority += 0.05;
  if (signals.hasExcerpt) priority += 0.05;
  if (signals.daysSinceUpdate < 30) priority += 0.1;
  else if (signals.daysSinceUpdate > 365) priority -= 0.1;

  const changefreq: SitemapPriority["changefreq"] =
    signals.daysSinceUpdate < 7 ? "daily" :
    signals.daysSinceUpdate < 30 ? "weekly" :
    signals.daysSinceUpdate < 180 ? "monthly" : "yearly";

  return { priority: Math.min(0.95, Math.max(0.1, priority)), changefreq };
}

// AI-enhanced version — falls back to heuristic if API unavailable
export async function getSitemapPriority(post: Post): Promise<SitemapPriority> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return heuristicPriority(buildSignals(post));

  const signals = buildSignals(post);

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'Given these content quality signals for a blog post on a Creative Director\'s personal site, assign: a changefreq value (always, hourly, daily, weekly, monthly, yearly, never) and a priority value (0.0-1.0). Base this on content freshness, depth, and strategic importance. Homepage is always 1.0. Return only JSON: {changefreq, priority}',
        },
        {
          role: "user",
          content: `Post: "${post.title}"\nWord count: ${signals.wordCount}\nTags: ${signals.tagCount}\nHas excerpt: ${signals.hasExcerpt}\nDays since update: ${signals.daysSinceUpdate}`,
        },
      ],
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as SitemapPriority;

    const validFreqs = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
    if (!validFreqs.includes(parsed.changefreq)) parsed.changefreq = "monthly";
    parsed.priority = Math.min(0.95, Math.max(0.1, parsed.priority));

    return parsed;
  } catch {
    return heuristicPriority(signals);
  }
}
