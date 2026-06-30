import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { getAllPosts } from "@/lib/mdx";

const CONTENT_GAPS_PATH = path.join(process.cwd(), "CONTENT_GAPS.md");
const BLOG_DIR = path.join(process.cwd(), "content/blog");

// Vercel cron: runs every Monday at 4am UTC
// vercel.json: { "crons": [{ "path": "/api/cron/content-gap", "schedule": "0 4 * * 1" }] }
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  try {
    // Step 1: Inventory current content
    const posts = getAllPosts();
    const inventory = posts.map((p) => ({
      title: p.title,
      tags: p.tags,
      date: p.date,
      description: p.description,
    }));

    const inventoryText = inventory
      .map((p) => `- "${p.title}" (${p.date}) | tags: ${p.tags.join(", ")} | desc: ${p.description}`)
      .join("\n");

    // Step 2: Generate gap analysis
    const gapResponse = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an SEO content strategist specialising in creative industry professionals. Given this inventory of existing blog posts on a Creative Director and Brand Strategist's personal site, identify: 10 high-value topics not yet covered that potential clients in Helsinki and internationally would search for, 5 long-tail keyword opportunities being missed, 3 topics where the existing content should be expanded or updated. Return as structured JSON with fields: gaps (array of {topic, targetKeyword, searchIntent, suggestedTitle, priority}), expansions (array of {existingSlug, suggestion}), longTail (array of strings).",
        },
        {
          role: "user",
          content: `Current content inventory:\n${inventoryText}`,
        },
      ],
      temperature: 0.4,
    });

    const rawGap = gapResponse.choices[0]?.message?.content?.trim() ?? "{}";
    let gapData: {
      gaps: Array<{ topic: string; targetKeyword: string; searchIntent: string; suggestedTitle: string; priority: number }>;
      expansions: Array<{ existingSlug: string; suggestion: string }>;
      longTail: string[];
    };

    try {
      const cleaned = rawGap.replace(/```json\n?|\n?```/g, "").trim();
      gapData = JSON.parse(cleaned);
    } catch {
      gapData = { gaps: [], expansions: [], longTail: [] };
    }

    // Step 3: Write report
    const timestamp = new Date().toISOString();
    const report = [
      `# Content Gap Analysis`,
      ``,
      `Generated: ${timestamp}`,
      ``,
      `## High-Value Topic Gaps`,
      ``,
      ...(gapData.gaps ?? []).map(
        (g, i) =>
          `### ${i + 1}. ${g.topic} (Priority: ${g.priority})\n- **Target keyword:** ${g.targetKeyword}\n- **Search intent:** ${g.searchIntent}\n- **Suggested title:** ${g.suggestedTitle}`
      ),
      ``,
      `## Long-Tail Keyword Opportunities`,
      ``,
      ...(gapData.longTail ?? []).map((kw) => `- ${kw}`),
      ``,
      `## Expansion Suggestions for Existing Posts`,
      ``,
      ...(gapData.expansions ?? []).map((e) => `- **${e.existingSlug}:** ${e.suggestion}`),
    ].join("\n");

    fs.writeFileSync(CONTENT_GAPS_PATH, report, "utf8");

    // Step 4: Auto-generate top 3 draft posts
    const topGaps = (gapData.gaps ?? []).slice(0, 3);
    const draftsCreated: string[] = [];

    for (const gap of topGaps) {
      await new Promise((r) => setTimeout(r, 1000));

      const draftResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Write a complete, high-quality blog post for Emil Lavinen's personal site. Emil is a Helsinki-based Creative Director and Brand Strategist. Voice: direct, opinionated, no filler, no corporate language, observational. Requirements: minimum 900 words, H2 and H3 headings, bold and italic used meaningfully, at least one blockquote, written as genuine insight not generic advice. Return only the post content in MDX format including frontmatter with fields: title, date (today), excerpt, tags (array), published: false.",
          },
          {
            role: "user",
            content: `Topic: ${gap.topic}\nTarget keyword: ${gap.targetKeyword}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const draftContent = draftResponse.choices[0]?.message?.content?.trim() ?? "";
      const slugBase = gap.suggestedTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 60);
      const slug = `draft-${slugBase}`;
      const filePath = path.join(BLOG_DIR, `${slug}.mdx`);

      // Ensure it has published: false in frontmatter
      const safeContent = draftContent.includes("published:")
        ? draftContent
        : draftContent.replace(/^---\n/, `---\npublished: false\n`);

      fs.writeFileSync(filePath, safeContent, "utf8");
      draftsCreated.push(slug);
    }

    return NextResponse.json({
      success: true,
      timestamp,
      gapsIdentified: gapData.gaps?.length ?? 0,
      draftsCreated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
