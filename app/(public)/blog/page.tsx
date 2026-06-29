import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/mdx";
import { buildMetadata } from "@/lib/seo";
import { formatReadingTime } from "@/lib/reading-time";

export const metadata: Metadata = buildMetadata({
  title: "Writing",
  description:
    "Essays and ideas by Emil Lavinen — on brand strategy, creative direction, visual identity, and culture.",
  path: "/blog",
});

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <style>{`
        .post-row { color: var(--color-fg-secondary); transition: color var(--transition-base); text-decoration: none; }
        .post-row:hover { color: var(--color-fg); }
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
        {posts.length === 0 ? (
          <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--text-sm)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase" }}>
            No posts yet.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: "800px" }}>
            {posts.map((post) => (
              <li key={post.slug} style={{ marginBottom: "var(--space-8)" }}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="post-row"
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "var(--space-8)",
                    padding: "var(--space-4) 0",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-xl)",
                      fontWeight: 400,
                      margin: 0,
                      lineHeight: "var(--leading-snug)",
                    }}
                  >
                    {post.title}
                  </p>

                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <time
                      style={{
                        fontSize: "var(--text-sm)",
                        letterSpacing: "var(--tracking-wide)",
                        color: "var(--color-fg-muted)",
                        display: "block",
                      }}
                    >
                      {post.date}
                    </time>
                    <span style={{ fontSize: "var(--text-sm)", letterSpacing: "var(--tracking-wide)", color: "var(--color-fg-muted)", display: "block" }}>
                      {formatReadingTime(post.readingTime)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
