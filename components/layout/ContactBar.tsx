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
        minHeight: "40px",
        background: "var(--color-bg)",
        zIndex: 40,
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-3) 0",
      }}
    >
      <style>{`
        .contact-link {
          color: var(--color-fg-muted);
          transition: color var(--transition-base);
          text-decoration: none;
          font-size: var(--text-xs);
          letter-spacing: var(--tracking-widest);
          text-transform: uppercase;
          font-family: var(--font-sans);
          font-weight: 400;
        }
        .contact-link:hover { color: var(--color-fg); }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "var(--space-2) var(--space-6)",
          padding: "0 var(--space-6)",
        }}
      >
        {LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-link"
          >
            {label.toUpperCase()}
          </a>
        ))}
      </div>
    </aside>
  );
}
