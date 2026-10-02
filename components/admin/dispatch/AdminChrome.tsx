import Link from "next/link";
import LogoutButton from "@/components/admin/LogoutButton";

/**
 * Shared frame for the admin: the section links and the small set of
 * classes the DISPATCH pages use. Same look as the existing posts admin —
 * monospace, small uppercase labels, hairlines, nothing else.
 */

const SECTIONS = [
  { href: "/admin", label: "Posts" },
  { href: "/admin/works", label: "Works" },
  { href: "/admin/drop", label: "Drop" },
  { href: "/admin/connections", label: "Connections" },
  { href: "/admin/instagram", label: "Instagram" },
];

export function AdminStyles() {
  return (
    <style>{`
      .adm { max-width: 960px; margin: 0 auto; padding: var(--space-8) var(--space-5) var(--space-24); font-family: var(--font-sans); color: var(--color-fg); }
      @media (min-width: 720px) { .adm { padding: var(--space-12) var(--space-8) var(--space-24); } }
      .adm-nav { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-6); margin-bottom: var(--space-12); }
      .adm-nav a { font-size: var(--text-xs); letter-spacing: var(--tracking-widest); text-transform: uppercase; color: var(--color-fg-muted); text-decoration: none; }
      .adm-nav a[aria-current="page"], .adm-nav a:hover { color: var(--color-fg); text-decoration: underline; }
      .adm-nav__end { margin-left: auto; }
      .adm h1 { font-size: var(--text-base); font-weight: 400; letter-spacing: var(--tracking-widest); text-transform: uppercase; margin: 0 0 var(--space-8); }
      .adm h2 { font-size: var(--text-xs); font-weight: 400; letter-spacing: var(--tracking-widest); text-transform: uppercase; color: var(--color-fg-muted); margin: var(--space-12) 0 var(--space-4); }
      .adm-label { display: block; font-size: var(--text-xs); letter-spacing: var(--tracking-widest); text-transform: uppercase; color: var(--color-fg-muted); margin-bottom: var(--space-2); }
      .adm-input, .adm-textarea { width: 100%; box-sizing: border-box; border: 1px solid #d4d4d4; border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); font-size: 16px; font-family: var(--font-sans); background: #fff; color: var(--color-fg); }
      .adm-textarea { min-height: 7rem; resize: vertical; line-height: var(--leading-normal); }
      .adm-field { margin-bottom: var(--space-5); }
      .adm-row { display: grid; grid-template-columns: 1fr; gap: 0 var(--space-4); }
      @media (min-width: 720px) { .adm-row { grid-template-columns: 1fr 1fr; } }
      .adm-btn { display: inline-block; padding: var(--space-2) var(--space-5); font-size: var(--text-sm); font-family: var(--font-sans); background: var(--color-fg); color: var(--color-bg); border: none; border-radius: var(--radius-md); cursor: pointer; text-decoration: none; }
      .adm-btn[disabled] { opacity: 0.4; cursor: default; }
      .adm-btn--quiet { background: none; color: var(--color-fg-secondary); border: 1px solid #d4d4d4; }
      .adm-btn--small { padding: 2px var(--space-3); font-size: var(--text-xs); }
      .adm-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
      .adm-table th { text-align: left; font-weight: 400; font-size: var(--text-xs); letter-spacing: var(--tracking-widest); text-transform: uppercase; color: var(--color-fg-muted); padding: 0 var(--space-3) var(--space-3) 0; border-bottom: 1px solid #e5e5e5; }
      .adm-table td { padding: var(--space-3) var(--space-3) var(--space-3) 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
      .adm-muted { color: var(--color-fg-muted); }
      .adm-small { font-size: var(--text-xs); }
      .adm-note { border: 1px solid #e5e5e5; padding: var(--space-3) var(--space-4); font-size: var(--text-sm); margin-bottom: var(--space-6); }
      .adm-note--error { border-color: #fca5a5; color: #b91c1c; }
      .adm-note--ok { border-color: #bbf7d0; color: #166534; }
      .adm-chips { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); }
      .adm-chip { font-size: var(--text-xs); letter-spacing: 0.04em; white-space: nowrap; }
      .adm-chip--posted { color: #166534; }
      .adm-chip--failed, .adm-chip--unknown, .adm-chip--needs_attention { color: #b91c1c; }
      .adm-chip--pending, .adm-chip--posting { color: #1d4ed8; }
      .adm-chip--held, .adm-chip--skipped, .adm-chip--disabled { color: var(--color-fg-muted); }
      .adm-chip--ok { color: #166534; }
      .adm-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
      .adm-pre { white-space: pre-wrap; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-fg-secondary); margin: var(--space-1) 0 0; }
      .adm-scroll { overflow-x: auto; }
    `}</style>
  );
}

export function AdminNav({ current, showLogout = true }: { current: string; showLogout?: boolean }) {
  return (
    <nav className="adm-nav" aria-label="Admin">
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} aria-current={current === s.href ? "page" : undefined}>
          {s.label}
        </Link>
      ))}
      {showLogout && (
        <span className="adm-nav__end">
          <LogoutButton />
        </span>
      )}
    </nav>
  );
}

export function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === "string" ? searchParams.error : null;
  const ok = typeof searchParams.ok === "string" ? searchParams.ok : typeof searchParams.connected === "string" ? `${searchParams.connected} connected.` : null;
  if (error) return <p className="adm-note adm-note--error">{error}</p>;
  if (ok) return <p className="adm-note adm-note--ok">{ok}</p>;
  return null;
}

export function StoreMissing() {
  return (
    <p className="adm-note adm-note--error">
      The DISPATCH store is not configured. Add Neon Postgres and Vercel Blob from the Vercel Storage tab (DATABASE_URL,
      BLOB_READ_WRITE_TOKEN) — see SETUP.md.
    </p>
  );
}

export function when(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Helsinki",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
