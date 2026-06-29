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
        .post-back:hover { opacity: 0.5; }
        .post-back { transition: opacity var(--transition-base); }
      `}</style>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-16) var(--space-8)",
          paddingBottom: "calc(var(--space-16) + 44px)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <article style={{ maxWidth: "680px" }}>
          <header style={{ marginBottom: "var(--space-12)" }}>
            <Link
              href="/blog"
              className="post-back"
              style={{
                fontSize: "var(--text-xs)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-muted)",
                textDecoration: "none",
                display: "inline-block",
                marginBottom: "var(--space-6)",
              }}
            >
              ← Writing
            </Link>

            <h1
              style={{
                fontSize: "var(--text-3xl)",
                fontWeight: 300,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                margin: "0 0 var(--space-4)",
                color: "var(--color-fg)",
              }}
            >
              {post.title}
            </h1>

            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
              <time
                style={{
                  fontSize: "var(--text-xs)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-muted)",
                }}
              >
                {post.date}
              </time>
              <span style={{ color: "var(--color-border)" }}>·</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                {formatReadingTime(post.readingTime)}
              </span>
            </div>
          </header>

          <div className="prose prose-neutral">
            <MDXRemote source={post.content} components={mdxComponents} />
          </div>
        </article>
      </div>
    </>
  );
}
