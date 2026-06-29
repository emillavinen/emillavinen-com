"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const TiptapEditor = dynamic(() => import("./editor/TiptapEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-6)", color: "var(--color-muted)", fontSize: "var(--text-sm)" }}>
      Loading editor…
    </div>
  ),
});

export interface PostData {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string;
  content: string;
  published: boolean;
  sha?: string;
}

interface PostFormProps {
  initialData?: PostData;
  isNew?: boolean;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

const EMPTY: PostData = {
  slug: "", title: "", date: today(), description: "", tags: "", content: "", published: false,
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function PostForm({ initialData, isNew = false }: PostFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<PostData>(initialData ?? EMPTY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isNew && !slugEdited) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.title) }));
    }
  }, [form.title, isNew, slugEdited]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    if (name === "slug") setSlugEdited(true);
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleContentChange(markdown: string) {
    setForm((prev) => ({ ...prev, content: markdown }));
    setStatus("idle");
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    if (!isNew) {
      autoSaveRef.current = setTimeout(() => save(form.published, true), 60_000);
    }
  }

  const save = useCallback(
    async (publish: boolean, silent = false) => {
      if (!silent) setStatus("saving");
      setErrorMsg("");
      try {
        const body = { ...form, published: publish };
        const url = isNew ? "/api/admin/posts" : `/api/admin/posts/${form.slug}`;
        const res = await fetch(url, {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        if (publish) await fetch("/api/admin/deploy", { method: "POST" });
        setForm((prev) => ({ ...prev, published: publish }));
        setStatus("saved");
        if (isNew) router.push(`/admin/posts/${form.slug}/edit`);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Save failed");
      }
    },
    [form, isNew, router]
  );

  async function handleDelete() {
    if (!confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/posts/${form.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/admin");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const inputStyle = {
    width: "100%",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-2) var(--space-3)",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-sans)",
    color: "var(--color-fg)",
    background: "var(--color-bg)",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--color-muted)",
    marginBottom: "var(--space-2)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Title */}
      <div>
        <label style={labelStyle}>Title</label>
        <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="Post title" style={{ ...inputStyle, fontSize: "var(--text-base)" }} />
      </div>

      {/* Slug */}
      <div>
        <label style={labelStyle}>Slug</label>
        <input
          type="text" name="slug" value={form.slug} onChange={handleChange}
          disabled={!isNew} placeholder="post-slug" style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }}
        />
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginTop: "var(--space-1)", fontFamily: "var(--font-sans)" }}>
          emillavinen.com/blog/{form.slug || "…"}
        </p>
      </div>

      {/* Date + Tags row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <div>
          <label style={labelStyle}>Publish Date</label>
          <input type="date" name="date" value={form.date} onChange={handleChange} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tags</label>
          <input type="text" name="tags" value={form.tags} onChange={handleChange} placeholder="design, brand, strategy" style={inputStyle} />
        </div>
      </div>

      {/* Meta description */}
      <div>
        <label style={labelStyle}>
          Meta Description{" "}
          <span style={{ fontWeight: 400, textTransform: "none", color: form.description.length > 160 ? "#ef4444" : "var(--color-muted)" }}>
            ({form.description.length}/160)
          </span>
        </label>
        <textarea
          name="description" value={form.description} onChange={handleChange}
          rows={2} placeholder="Brief description for search engines…"
          style={{ ...inputStyle, resize: "none" }}
        />
      </div>

      {/* Rich text editor */}
      <div>
        <label style={labelStyle}>Content</label>
        <TiptapEditor initialContent={form.content} onChange={handleContentChange} />
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <span style={{ fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", color: "var(--color-muted)" }}>
            {status === "saving" && "Saving…"}
            {status === "saved" && <span style={{ color: "#16a34a" }}>Saved ✓</span>}
            {status === "error" && <span style={{ color: "#ef4444" }}>{errorMsg}</span>}
          </span>
          {form.published && status !== "saving" && (
            <span style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-fg)", fontFamily: "var(--font-sans)" }}>
              Published
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {!isNew && (
            <button onClick={handleDelete} style={{ padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
              Delete
            </button>
          )}
          <button
            onClick={() => save(false)}
            disabled={status === "saving"}
            style={{ padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg)", cursor: "pointer", opacity: status === "saving" ? 0.5 : 1 }}
          >
            Save draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={status === "saving"}
            style={{ padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", borderRadius: "var(--radius-md)", background: "var(--color-fg)", color: "var(--color-bg)", border: "none", cursor: "pointer", opacity: status === "saving" ? 0.5 : 1 }}
          >
            {form.published ? "Update & deploy" : "Publish & deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}
