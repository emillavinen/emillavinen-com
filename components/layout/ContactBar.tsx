import { SOCIAL_LINKS } from "@/lib/constants";

const LINKS = [
  { href: SOCIAL_LINKS.email,     label: "email" },
  { href: SOCIAL_LINKS.instagram, label: "instagram" },
  { href: SOCIAL_LINKS.linkedin,  label: "linkedin" },
  { href: SOCIAL_LINKS.spotify,   label: "spotify" },
  { href: SOCIAL_LINKS.behance,   label: "behance" },
  { href: SOCIAL_LINKS.pinterest, label: "pinterest" },
];

export default function ContactBar() {
  return (
    <aside
      id="contact"
      style={{
        fontFamily: "var(--font-sans)",
        padding: "var(--space-8) var(--space-8)",
      }}
    >
      <style>{`
        .contact-link {
          color: var(--color-fg-muted);
          transition: color var(--transition-base);
          text-decoration: none;
          font-size: var(--text-xs);
          letter-spacing: var(--tracking-widest);
          font-family: var(--font-sans);
          font-weight: 400;
        }
        .contact-link:hover { color: var(--color-fg); }
      `}</style>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2) var(--space-6)",
        }}
      >
        {LINKS.map(({ href, label }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("mailto") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="contact-link"
          >
            {label}
          </a>
        ))}
      </div>
    </aside>
  );
}
