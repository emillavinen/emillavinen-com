import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import { getAllPosts } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Writing by Emil Lavinen — on design, creativity, and culture.",
  openGraph: {
    title: "Blog — Emil Lavinen",
    description: "Writing by Emil Lavinen — on design, creativity, and culture.",
    url: "https://emillavinen.com/blog",
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <Container>
      <h1 className="text-3xl font-light tracking-tight mb-12">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-neutral-400">No posts yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="flex items-baseline justify-between gap-8 py-6 group"
              >
                <div>
                  <p className="text-lg font-light group-hover:opacity-50 transition-opacity">
                    {post.title}
                  </p>
                  {post.description && (
                    <p className="text-sm text-neutral-400 mt-1">
                      {post.description}
                    </p>
                  )}
                </div>
                <time className="text-xs tracking-widest uppercase text-neutral-400 shrink-0">
                  {post.date}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
