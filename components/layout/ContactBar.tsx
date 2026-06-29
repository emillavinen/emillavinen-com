import { SOCIAL_LINKS, SOCIAL_LABELS } from "@/lib/constants";

const LINKS = [
  { href: SOCIAL_LINKS.email,     label: SOCIAL_LABELS.email },
  { href: SOCIAL_LINKS.instagram, label: SOCIAL_LABELS.instagram },
  { href: SOCIAL_LINKS.pinterest, label: SOCIAL_LABELS.pinterest },
  { href: SOCIAL_LINKS.spotify,   label: SOCIAL_LABELS.spotify },
  { href: SOCIAL_LINKS.behance,   label: SOCIAL_LABELS.behance },
  { href: SOCIAL_LINKS.linkedin,  label: SOCIAL_LABELS.linkedin },
];

export default function ContactBar() {
  return (
    <aside
      id="contact"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-bg)",
        zIndex: 40,
        fontFamily: "var(--font-sans)",
      }}
    >
      <style>{`
        .contact-link { color: var(--color-muted); transition: color var(--transition-base); text-decoration: none; font-size: var(--text-xs); letter-spacing: 0.02em; min-height: 44px; display: inline-flex; align-items: center; }
        .contact-link:hover { color: var(--color-fg); }
      `}</style>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-3) var(--space-8)",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-1) 0",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
            marginRight: "var(--space-4)",
          }}
        >
          Links
        </span>

        {LINKS.map(({ href, label }, i) => (
          <span key={href} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: "1px",
                  height: "10px",
                  background: "var(--color-border)",
                  margin: "0 var(--space-4)",
                }}
              />
            )}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-link"
            >
              {label}
            </a>
          </span>
        ))}
      </div>
    </aside>
  );
}
