import Link from "next/link";
import PostForm from "@/components/admin/PostForm";

export default function NewPostPage() {
  return (
    <div style={{ maxWidth: "768px", margin: "0 auto", padding: "var(--space-12) var(--space-8)", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-8)" }}>
        <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 400, letterSpacing: "var(--tracking-widest)", textTransform: "uppercase", color: "var(--color-fg)", margin: 0 }}>New post</h1>
        <Link href="/admin" style={{ fontSize: "var(--text-sm)", color: "var(--color-fg-muted)", textDecoration: "none" }}>
          ← All posts
        </Link>
      </div>
      <PostForm isNew />
    </div>
  );
}
