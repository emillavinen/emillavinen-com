"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

interface PlatformOption {
  id: string;
  label: string;
  enabled: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_FILES = 4;

/**
 * The drop page form. Files go from the browser straight to Vercel Blob
 * (client uploads — function bodies are capped at 4.5 MB), then the fields
 * and the upload URLs are posted to /api/admin/dispatch/drop, which makes
 * the variants and queues the work. `accept` lists JPEG first so an iPhone
 * hands over JPEG instead of HEIC.
 */
export default function DropForm({ platforms }: { platforms: PlatformOption[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<string[]>(platforms.filter((p) => p.enabled).map((p) => p.id));
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ slug: string; title: string; id: string } | null>(null);

  function pick(list: FileList | null) {
    setError("");
    const chosen = Array.from(list ?? []);
    if (chosen.some((f) => f.type.startsWith("video/"))) {
      setError("Video isn't supported yet — images only (JPEG, PNG, WebP).");
      return;
    }
    const bad = chosen.find((f) => !ACCEPT.split(",").includes(f.type));
    if (bad) {
      setError(`${bad.name} is ${bad.type || "an unknown type"} — use JPEG, PNG or WebP.`);
      return;
    }
    if (chosen.length > MAX_FILES) {
      setError(`At most ${MAX_FILES} images.`);
      return;
    }
    setFiles(chosen);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0) {
      setError("Add at least one image.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const uploads = [];
      for (const [i, file] of files.entries()) {
        setStatus(`Uploading ${i + 1} of ${files.length}…`);
        const safeName = file.name.replace(/[^\w.\-]+/g, "-").slice(-80) || "image";
        const blob = await upload(`uploads/${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/dispatch/upload",
          contentType: file.type,
        });
        uploads.push({ url: blob.url, name: file.name });
      }
      setStatus("Processing…");
      const res = await fetch("/api/admin/dispatch/drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploads,
          title: form.get("title"),
          caption: form.get("caption"),
          client: form.get("client"),
          tools: form.get("tools"),
          year: form.get("year"),
          tags: form.get("tags"),
          platforms: selected,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDone(data);
      setFiles([]);
      setStatus("");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {done && (
        <p className="adm-note adm-note--ok">
          “{done.title}” is on the site and queued.{" "}
          <a href={`/work/${done.slug}`} target="_blank" rel="noopener noreferrer">
            view
          </a>{" "}
          · <a href={`/admin/works/${done.id}`}>status</a>
        </p>
      )}
      {error && <p className="adm-note adm-note--error">{error}</p>}

      <div className="adm-field">
        <label className="adm-label" htmlFor="files">
          Images (1–{MAX_FILES})
        </label>
        <input id="files" type="file" accept={ACCEPT} multiple onChange={(e) => pick(e.target.files)} disabled={busy} />
        {files.length > 0 && <p className="adm-small adm-muted">{files.map((f) => f.name).join(", ")}</p>}
      </div>

      <div className="adm-field">
        <label className="adm-label" htmlFor="title">
          Title <span style={{ textTransform: "none" }}>(empty = file name)</span>
        </label>
        <input className="adm-input" id="title" name="title" autoComplete="off" disabled={busy} />
      </div>
      <div className="adm-field">
        <label className="adm-label" htmlFor="caption">Caption</label>
        <textarea className="adm-textarea" id="caption" name="caption" disabled={busy} />
      </div>
      <div className="adm-row">
        <div className="adm-field">
          <label className="adm-label" htmlFor="client">Client</label>
          <input className="adm-input" id="client" name="client" autoComplete="off" disabled={busy} />
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="year">Year</label>
          <input className="adm-input" id="year" name="year" inputMode="numeric" placeholder={String(new Date().getFullYear())} disabled={busy} />
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="tools">Tools</label>
          <input className="adm-input" id="tools" name="tools" placeholder="comma separated" autoComplete="off" disabled={busy} />
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="tags">Tags</label>
          <input className="adm-input" id="tags" name="tags" placeholder="comma separated" autoComplete="off" disabled={busy} />
        </div>
      </div>

      <fieldset className="adm-field" style={{ border: "none", padding: 0, margin: "0 0 var(--space-6)" }}>
        <legend className="adm-label">Post to</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2) var(--space-5)" }}>
          {platforms.map((p) => (
            <label key={p.id} className="adm-small" style={{ color: p.enabled ? "var(--color-fg)" : "var(--color-fg-muted)" }}>
              <input
                type="checkbox"
                checked={p.enabled && selected.includes(p.id)}
                disabled={!p.enabled || busy}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
              />{" "}
              {p.label}
              {!p.enabled && " (not connected)"}
            </label>
          ))}
        </div>
      </fieldset>

      <button className="adm-btn" type="submit" disabled={busy}>
        {busy ? status || "Working…" : "Drop"}
      </button>
    </form>
  );
}
