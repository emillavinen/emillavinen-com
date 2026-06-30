import fs from "fs";
import path from "path";
import matter from "gray-matter";
import OpenAI from "openai";
import { getAllPosts, getPostBySlug, getPostSlugs } from "@/lib/mdx";

const BLOG_DIR = path.join(process.cwd(), "content/blog");
const LINK_SUGGESTIONS_PATH = path.join(process.cwd(), "LINK_SUGGESTIONS.md");

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openaiClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function callOpenAI(client: OpenAI, systemPrompt: string, userContent: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

function readFrontmatter(slug: string): { data: Record<string, unknown>; content: string } {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  return { data, content };
}

function writeFrontmatter(slug: string, data: Record<string, unknown>, content: string) {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  const updated = matter.stringify(content, data);
  fs.writeFileSync(filePath, updated, "utf8");
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 238);
  return `PT${minutes}M`;
}

function scoreMetaDescription(desc: string, title: string): number {
  let score = 0;
  if (desc.length >= 150 && desc.length <= 158) score += 2;
  else if (desc.length >= 140 && desc.length <= 165) score += 1;
  const titleWords = title.toLowerCase().split(/\s+/);
  const descLower = desc.toLowerCase();
  const hasKeyword = titleWords.some((w) => w.length > 4 && descLower.includes(w));
  if (hasKeyword) score += 1;
  return score;
}

export interface SEOEngineLog {
  slug: string;
  operations: {
    metaDescription: string;
    tags: string;
    titleTag: string;
    excerpt: string;
    schema: string;
  };
}

// Operation 1: Meta description optimisation
async function enhanceMetaDescription(
  client: OpenAI,
  slug: string,
  data: Record<string, unknown>,
  content: string,
  log: SEOEngineLog
) {
  const title = String(data.title ?? "");
  const existing = String(data.description ?? "");

  const generated = await callOpenAI(
    client,
    'You are an SEO specialist. Given a blog post title and content, write an optimised meta description that is exactly 150-158 characters, includes the primary keyword naturally, creates genuine curiosity without clickbait, and accurately represents the content. Return only the meta description string, nothing else.',
    `Title: ${title}\n\nContent:\n${content.slice(0, 3000)}`
  );

  const existingScore = scoreMetaDescription(existing, title);
  const generatedScore = scoreMetaDescription(generated, title);

  if (generatedScore > existingScore) {
    data.description = generated;
    log.operations.metaDescription = `Updated (existing score: ${existingScore}, new score: ${generatedScore}). New: "${generated}"`;
  } else {
    log.operations.metaDescription = `Kept existing (score: ${existingScore} >= generated score: ${generatedScore}). "${existing}"`;
  }
}

// Operation 2: Tag generation and enrichment
async function enhanceTags(
  client: OpenAI,
  slug: string,
  data: Record<string, unknown>,
  content: string,
  log: SEOEngineLog
) {
  const existing: string[] = Array.isArray(data.tags) ? data.tags.map(String) : [];

  const raw = await callOpenAI(
    client,
    'You are an SEO content strategist. Given this blog post content, generate 5-8 highly specific tags that: include at least one broad category tag, at least one specific long-tail tag, at least two tags matching terms a potential client searching for a Creative Director or Brand Strategist would use, and at least one topic-specific tag. Return only a JSON array of tag strings in lowercase with hyphens, nothing else.',
    `Content:\n${content.slice(0, 3000)}`
  );

  let generated: string[] = [];
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    generated = JSON.parse(cleaned);
  } catch {
    log.operations.tags = `Failed to parse generated tags: ${raw}`;
    return;
  }

  const merged = Array.from(new Set([...existing, ...generated]));
  data.tags = merged;
  log.operations.tags = `Merged ${existing.length} existing + ${generated.length} generated = ${merged.length} total tags`;
}

// Operation 3: Internal link suggestions
async function generateLinkSuggestions(
  client: OpenAI,
  slug: string,
  data: Record<string, unknown>,
  content: string,
  allPosts: Array<{ slug: string; title: string; tags: string[] }>,
  log: SEOEngineLog
) {
  const otherPosts = allPosts.filter((p) => p.slug !== slug);
  const postList = otherPosts.map((p) => `- slug: ${p.slug}, title: "${p.title}", tags: ${p.tags.join(", ")}`).join("\n");

  const raw = await callOpenAI(
    client,
    'Given this blog post and a list of all other posts on the site, identify the 3 most relevant posts to link to from within the content. For each, suggest the most natural anchor text and a paragraph where the link would fit. Return as JSON: [{slug, anchorText, context}]. Only suggest links that would genuinely help the reader.',
    `Current post: "${data.title}"\n\nContent:\n${content.slice(0, 2000)}\n\nOther posts:\n${postList}`
  );

  log.operations.schema = `Link suggestions generated`;
  return { slug, suggestions: raw };
}

// Operation 4: Title tag optimisation
async function enhanceTitle(
  client: OpenAI,
  slug: string,
  data: Record<string, unknown>,
  content: string,
  log: SEOEngineLog
) {
  const original = String(data.title ?? "");

  const improved = await callOpenAI(
    client,
    'Evaluate this blog post title for SEO. Consider: character count (aim for 50-60 characters), keyword placement (primary keyword early), clarity, and search intent match. If the title can be meaningfully improved, return an improved version. If it is already strong, return the original unchanged. Return only the title string.',
    `Title: ${original}\n\nContent preview:\n${content.slice(0, 1000)}`
  );

  const cleanImproved = improved.replace(/^["']|["']$/g, "").trim();
  if (cleanImproved && cleanImproved !== original) {
    data.title = cleanImproved;
    log.operations.titleTag = `Updated: "${original}" → "${cleanImproved}"`;
  } else {
    log.operations.titleTag = `Kept original: "${original}"`;
  }
}

// Operation 5: Excerpt generation
async function enhanceExcerpt(
  client: OpenAI,
  slug: string,
  data: Record<string, unknown>,
  content: string,
  log: SEOEngineLog
) {
  const existing = String(data.excerpt ?? "");
  if (existing.length >= 80) {
    log.operations.excerpt = `Skipped — existing excerpt is ${existing.length} chars`;
    return;
  }

  const generated = await callOpenAI(
    client,
    'Write a compelling 120-140 character excerpt for this blog post. It should hook the reader in the first clause, include the primary topic naturally, and end with enough tension that the reader wants to continue. Return only the excerpt string.',
    `Title: ${data.title}\n\nContent:\n${content.slice(0, 2000)}`
  );

  data.excerpt = generated;
  log.operations.excerpt = `Generated: "${generated}"`;
}

// Operation 6: Schema enhancement
function generateSchema(slug: string, data: Record<string, unknown>, content: string) {
  const wordCount = countWords(content);
  const schemaPath = path.join(BLOG_DIR, `${slug}.schema.json`);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.description,
    author: {
      "@type": "Person",
      name: "Emil Lavinen",
      url: "https://emillavinen.com",
    },
    datePublished: data.date,
    dateModified: data.date,
    keywords: Array.isArray(data.tags) ? data.tags.join(", ") : "",
    wordCount,
    timeRequired: estimateReadingTime(wordCount),
    publisher: {
      "@type": "Person",
      name: "Emil Lavinen",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://emillavinen.com/blog/${slug}`,
    },
  };

  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf8");
  return `Schema written to ${slug}.schema.json (${wordCount} words)`;
}

export async function runSEOEngine(): Promise<SEOEngineLog[]> {
  const enabled = process.env.SEO_ENGINE_ENABLED !== "false";
  if (!enabled) {
    console.log("SEO engine disabled via SEO_ENGINE_ENABLED env var");
    return [];
  }

  const client = openaiClient();
  const slugs = getPostSlugs();
  const allPosts = getAllPosts().map((p) => ({ slug: p.slug, title: p.title, tags: p.tags }));
  const logs: SEOEngineLog[] = [];
  const linkSuggestions: string[] = [`# Internal Link Suggestions\n\nGenerated: ${new Date().toISOString()}\n`];

  const BATCH_SIZE = 5;
  for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
    const batch = slugs.slice(i, i + BATCH_SIZE);
    for (const slug of batch) {
      const { data, content } = readFrontmatter(slug);

      const log: SEOEngineLog = {
        slug,
        operations: {
          metaDescription: "",
          tags: "",
          titleTag: "",
          excerpt: "",
          schema: "",
        },
      };

      try {
        await enhanceMetaDescription(client, slug, data, content, log);
        await delay(1000);

        await enhanceTags(client, slug, data, content, log);
        await delay(1000);

        const linkResult = await generateLinkSuggestions(client, slug, data, content, allPosts, log);
        if (linkResult) {
          linkSuggestions.push(`\n## ${slug}\n\n${linkResult.suggestions}\n`);
        }
        await delay(1000);

        await enhanceTitle(client, slug, data, content, log);
        await delay(1000);

        await enhanceExcerpt(client, slug, data, content, log);
        await delay(1000);

        log.operations.schema = generateSchema(slug, data, content);

        writeFrontmatter(slug, data, content);
      } catch (err) {
        console.error(`Error processing ${slug}:`, err);
      }

      logs.push(log);
    }
  }

  fs.writeFileSync(LINK_SUGGESTIONS_PATH, linkSuggestions.join("\n"), "utf8");

  return logs;
}
