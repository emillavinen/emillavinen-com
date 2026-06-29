import { notFound } from "next/navigation";
import Link from "next/link";
import matter from "gray-matter";
import PostForm from "@/components/admin/PostForm";
import { getFile } from "@/lib/github";

interface Props {
  params: Promise<{ slug: string }>;
}

function normalizeDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString().split("T")[0];
  return String(raw ?? "");
}

export default async function EditPostPage({ params }: Props) {
  const { slug } = await params;
  const file = await getFile(`content/blog/${slug}.mdx`);
  if (!file) notFound();

  const { data, content } = matter(file.content);

  return (
    <div style={{ maxWidth: "768px", margin: "0 auto", padding: "var(--space-12) var(--space-8)", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-8)" }}>
        <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 400, letterSpacing: "var(--tracking-widest)", textTransform: "uppercase", color: "var(--color-fg)", margin: 0 }}>Edit post</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <a
            href={`/blog/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "var(--text-sm)", color: "var(--color-fg-muted)", textDecoration: "none" }}
          >
            View ↗
          </a>
          <Link href="/admin" style={{ fontSize: "var(--text-sm)", color: "var(--color-fg-muted)", textDecoration: "none" }}>
            ← All posts
          </Link>
        </div>
      </div>
      <PostForm
        initialData={{
          slug,
          sha: file.sha,
          title: data.title ?? "",
          date: normalizeDate(data.date),
          description: data.description ?? "",
          tags: Array.isArray(data.tags) ? data.tags.join(", ") : (data.tags ?? ""),
          content: content.trim(),
          published: data.published === true,
        }}
        isNew={false}
      />
    </div>
  );
}
