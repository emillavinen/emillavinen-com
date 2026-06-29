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
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-3) var(--space-8)",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-1) var(--space-6)",
        }}
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
            marginRight: "var(--space-2)",
          }}
        >
          Links
        </span>

        {LINKS.map(({ href, label }, i) => (
          <span key={href} style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
            {i > 0 && (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: "1px",
                  height: "10px",
                  background: "var(--color-border)",
                }}
              />
            )}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-muted)",
                textDecoration: "none",
                letterSpacing: "0.02em",
                transition: "color var(--transition-base)",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-fg)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted)")}
            >
              {label}
            </a>
          </span>
        ))}
      </div>
    </aside>
  );
}
