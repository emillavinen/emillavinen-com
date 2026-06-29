import Link from "next/link";
import { listFiles, getFile } from "@/lib/github";
import matter from "gray-matter";
import LogoutButton from "@/components/admin/LogoutButton";

function normalizeDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString().split("T")[0];
  return String(raw ?? "");
}

async function getPosts() {
  const files = await listFiles("content/blog");
  const mdxFiles = files.filter((f) => f.name.endsWith(".mdx"));

  const posts = await Promise.all(
    mdxFiles.map(async (f) => {
      const file = await getFile(f.path);
      if (!file) return null;
      const { data } = matter(file.content);
      return {
        slug: f.name.replace(/\.mdx$/, ""),
        title: data.title ?? f.name,
        date: normalizeDate(data.date),
        published: data.published === true,
      };
    })
  );

  return posts
    .filter(Boolean)
    .sort((a, b) => b!.date.localeCompare(a!.date));
}

export default async function AdminDashboard() {
  let posts: Awaited<ReturnType<typeof getPosts>> = [];
  let configError: string | null = null;

  try {
    posts = await getPosts();
  } catch (err) {
    configError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div style={{ maxWidth: "768px", margin: "0 auto", padding: "var(--space-12) var(--space-8)", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-12)" }}>
        <h1 style={{ fontSize: "var(--text-base)", fontWeight: 400, letterSpacing: "var(--tracking-widest)", textTransform: "uppercase", color: "var(--color-fg)", margin: 0 }}>Posts</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <Link
            href="/admin/posts/new"
            style={{ padding: "var(--space-2) var(--space-6)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-fg)", color: "var(--color-bg)", textDecoration: "none", borderRadius: "var(--radius-md)" }}
          >
            New post
          </Link>
          <LogoutButton />
        </div>
      </div>

      {configError ? (
        <div style={{ border: "1px solid #fca5a5", padding: "var(--space-4)", fontSize: "var(--text-sm)" }}>
          <p style={{ fontWeight: 500, marginBottom: "var(--space-1)", color: "#dc2626" }}>GitHub not configured</p>
          <p style={{ color: "#dc2626" }}>{configError}</p>
          <p style={{ marginTop: "var(--space-2)", color: "#ef4444" }}>
            Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in your environment.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--text-sm)" }}>No posts yet.</p>
      ) : (
        <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e5e5", textAlign: "left" }}>
              <th style={{ paddingBottom: "var(--space-3)", fontWeight: 400, color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-widest)" }}>Title</th>
              <th style={{ paddingBottom: "var(--space-3)", fontWeight: 400, color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-widest)" }}>Date</th>
              <th style={{ paddingBottom: "var(--space-3)", fontWeight: 400, color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-widest)" }}>Status</th>
              <th style={{ paddingBottom: "var(--space-3)" }} />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post!.slug} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "var(--space-3) 0", color: "var(--color-fg)" }}>{post!.title}</td>
                <td style={{ padding: "var(--space-3) 0", color: "var(--color-fg-muted)" }}>{post!.date}</td>
                <td style={{ padding: "var(--space-3) 0" }}>
                  <span style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: post!.published ? "var(--color-fg)" : "var(--color-fg-muted)" }}>
                    {post!.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td style={{ padding: "var(--space-3) 0", textAlign: "right" }}>
                  <Link
                    href={`/admin/posts/${post!.slug}/edit`}
                    style={{ color: "var(--color-fg-muted)", textDecoration: "none", fontSize: "var(--text-sm)" }}
                  >
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
