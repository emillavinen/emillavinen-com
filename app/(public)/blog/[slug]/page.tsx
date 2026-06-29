import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPostBySlug, getPostSlugs } from "@/lib/mdx";
import { buildMetadata } from "@/lib/seo";
import { formatReadingTime } from "@/lib/reading-time";
import SpotifyEmbed from "@/components/ui/SpotifyEmbed";
import VideoEmbed from "@/components/ui/VideoEmbed";
import Callout from "@/components/ui/Callout";
import ImageBlock from "@/components/ui/ImageBlock";
import { SITE_NAME } from "@/lib/constants";

interface Props {
  params: Promise<{ slug: string }>;
}

const mdxComponents = { SpotifyEmbed, VideoEmbed, Callout, ImageBlock };

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!getPostSlugs().includes(slug)) return {};

  const post = getPostBySlug(slug);
  return buildMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${slug}`,
    type: "article",
    publishedTime: post.date,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  if (!getPostSlugs().includes(slug)) notFound();

  const post = getPostBySlug(slug);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Person", name: SITE_NAME },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <style>{`
        .post-back { color: var(--color-fg-muted); transition: color var(--transition-base); text-decoration: none; }
        .post-back:hover { color: var(--color-fg); }
      `}</style>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-32) var(--space-8)",
          paddingBottom: "calc(var(--space-32) + 80px)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <article style={{ maxWidth: "680px" }}>
          <header style={{ marginBottom: "var(--space-12)" }}>
            <Link
              href="/blog"
              className="post-back"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
                display: "inline-block",
                marginBottom: "var(--space-12)",
              }}
            >
              ← Blog
            </Link>

            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5vw, 3rem)",
                fontWeight: 400,
                letterSpacing: "var(--tracking-tight)",
                lineHeight: "var(--leading-snug)",
                margin: "0 0 var(--space-4)",
                color: "var(--color-fg)",
              }}
            >
              {post.title}
            </h1>

            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
                color: "var(--color-fg-muted)",
                display: "flex",
                gap: "var(--space-6)",
                marginTop: "var(--space-4)",
              }}
            >
              <time>{post.date}</time>
              <span>{formatReadingTime(post.readingTime)}</span>
            </div>
          </header>

          <div
            className="prose prose-neutral"
            style={{ marginTop: "var(--space-12)" }}
          >
            <MDXRemote source={post.content} components={mdxComponents} />
          </div>
        </article>
      </div>
    </>
  );
}
