"use client";

import { useState } from "react";
import { getAllTestimonials, type Testimonial } from "@/content/testimonials";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-2) var(--space-3)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  border: "1px solid #e5e5e5",
  borderRadius: "var(--radius-md)",
  background: "#fff",
  color: "var(--color-fg)",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-fg-muted)",
  marginBottom: "var(--space-1)",
};

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <label style={labelStyle}>{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </div>
  );
}

export default function TestimonialsAdminPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(getAllTestimonials());
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [saved, setSaved] = useState(false);

  function startNew() {
    setEditing({
      id: `t-${Date.now()}`,
      name: "",
      role: "",
      company: null,
      companyUrl: null,
      text: "",
      date: new Date().toISOString().split("T")[0],
      featured: false,
      project: null,
    });
    setSaved(false);
  }

  function saveEditing() {
    if (!editing) return;
    setTestimonials((prev) => {
      const exists = prev.find((t) => t.id === editing.id);
      if (exists) return prev.map((t) => (t.id === editing.id ? editing : t));
      return [editing, ...prev];
    });
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function deleteTestimonial(id: string) {
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
  }

  function toggleFeatured(id: string) {
    setTestimonials((prev) => prev.map((t) => (t.id === id ? { ...t, featured: !t.featured } : t)));
  }

  return (
    <div
      style={{
        maxWidth: "768px",
        margin: "0 auto",
        padding: "var(--space-12) var(--space-8)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-12)",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-base)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-fg)",
            margin: 0,
          }}
        >
          Testimonials
        </h1>
        <button
          onClick={startNew}
          style={{
            padding: "var(--space-2) var(--space-6)",
            fontSize: "var(--text-sm)",
            background: "var(--color-fg)",
            color: "var(--color-bg)",
            border: "none",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}
        >
          Add testimonial
        </button>
      </div>

      {saved && (
        <p style={{ color: "green", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
          Saved. Update the TypeScript file manually to persist changes.
        </p>
      )}

      <p style={{ color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", marginBottom: "var(--space-8)", letterSpacing: "var(--tracking-wide)" }}>
        Note: Changes here are in-memory only. To persist, copy the updated testimonial data into{" "}
        <code>/content/testimonials.ts</code>.
      </p>

      {editing && (
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-6)",
            marginBottom: "var(--space-8)",
          }}
        >
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 400, textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", marginBottom: "var(--space-6)" }}>
            {editing.name ? `Edit: ${editing.name}` : "New Testimonial"}
          </h2>
          <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
          <Field label="Role" value={editing.role} onChange={(v) => setEditing({ ...editing, role: v })} />
          <Field label="Company" value={editing.company ?? ""} onChange={(v) => setEditing({ ...editing, company: v || null })} />
          <Field label="Company URL" value={editing.companyUrl ?? ""} onChange={(v) => setEditing({ ...editing, companyUrl: v || null })} />
          <Field label="Project" value={editing.project ?? ""} onChange={(v) => setEditing({ ...editing, project: v || null })} />
          <Field label="Date (YYYY-MM-DD)" value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} />
          <Field label="Testimonial text" value={editing.text} onChange={(v) => setEditing({ ...editing, text: v })} textarea />
          <div style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <input
              type="checkbox"
              id="featured"
              checked={editing.featured}
              onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
            />
            <label htmlFor="featured" style={{ fontSize: "var(--text-sm)", color: "var(--color-fg)" }}>
              Featured on homepage
            </label>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              onClick={saveEditing}
              style={{
                padding: "var(--space-2) var(--space-6)",
                fontSize: "var(--text-sm)",
                background: "var(--color-fg)",
                color: "var(--color-bg)",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              style={{
                padding: "var(--space-2) var(--space-6)",
                fontSize: "var(--text-sm)",
                background: "none",
                color: "var(--color-fg-muted)",
                border: "1px solid #e5e5e5",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e5e5", textAlign: "left" }}>
            <th style={{ paddingBottom: "var(--space-3)", fontWeight: 400, color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-widest)" }}>Name</th>
            <th style={{ paddingBottom: "var(--space-3)", fontWeight: 400, color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-widest)" }}>Featured</th>
            <th style={{ paddingBottom: "var(--space-3)" }} />
          </tr>
        </thead>
        <tbody>
          {testimonials.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "var(--space-3) 0" }}>
                <div style={{ color: "var(--color-fg)" }}>{t.name}</div>
                <div style={{ color: "var(--color-fg-muted)", fontSize: "var(--text-xs)" }}>{t.role}{t.company ? `, ${t.company}` : ""}</div>
              </td>
              <td style={{ padding: "var(--space-3) 0" }}>
                <button
                  onClick={() => toggleFeatured(t.id)}
                  style={{
                    fontSize: "var(--text-xs)",
                    letterSpacing: "var(--tracking-wide)",
                    textTransform: "uppercase",
                    color: t.featured ? "var(--color-fg)" : "var(--color-fg-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {t.featured ? "Featured" : "Hidden"}
                </button>
              </td>
              <td style={{ padding: "var(--space-3) 0", textAlign: "right" }}>
                <button
                  onClick={() => { setEditing(t); setSaved(false); }}
                  style={{ color: "var(--color-fg-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-sm)", marginRight: "var(--space-4)" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTestimonial(t.id)}
                  style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-sm)" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
