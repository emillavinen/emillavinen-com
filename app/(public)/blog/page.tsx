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
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "var(--space-16) var(--space-8)",
        paddingBottom: "calc(var(--space-16) + 44px)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1
        style={{
          fontSize: "var(--text-3xl)",
          fontWeight: 300,
          letterSpacing: "-0.01em",
          margin: "0 0 var(--space-12)",
          color: "var(--color-fg)",
        }}
      >
        Writing
      </h1>

      {posts.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-sm)" }}>
          No posts yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: "680px" }}>
          {posts.map((post) => (
            <li
              key={post.slug}
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <Link
                href={`/blog/${post.slug}`}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "var(--space-8)",
                  padding: "var(--space-6) 0",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "opacity var(--transition-base)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.5")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <div>
                  <p
                    style={{
                      fontSize: "var(--text-lg)",
                      fontWeight: 300,
                      margin: "0 0 var(--space-1)",
                      color: "var(--color-fg)",
                    }}
                  >
                    {post.title}
                  </p>
                  {post.description && (
                    <p
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-muted)",
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {post.description}
                    </p>
                  )}
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    textAlign: "right",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                  }}
                >
                  <time
                    style={{
                      fontSize: "var(--text-xs)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--color-muted)",
                      display: "block",
                    }}
                  >
                    {post.date}
                  </time>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-muted)",
                      display: "block",
                    }}
                  >
                    {formatReadingTime(post.readingTime)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
          <li style={{ borderTop: "1px solid var(--color-border)" }} />
        </ul>
      )}
    </div>
  );
}
