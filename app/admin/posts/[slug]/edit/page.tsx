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
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-medium">Edit post</h1>
        <div className="flex items-center gap-4">
          <a
            href={`/blog/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-400 hover:text-black"
          >
            View ↗
          </a>
          <Link href="/admin" className="text-sm text-neutral-400 hover:text-black">
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
