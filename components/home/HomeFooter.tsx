import { SOCIAL_LINKS } from "@/lib/constants";

/**
 * Homepage footer — one centered row of small links, replacing the
 * Footer + ContactBar pair the other public routes use. The homepage is
 * the projects and the ways to reach Emil, nothing else, so this is the
 * whole of it.
 */
const LINKS = [
  { href: SOCIAL_LINKS.email, label: "email", external: false },
  { href: SOCIAL_LINKS.instagram, label: "instagram", external: true },
  { href: SOCIAL_LINKS.behance, label: "behance", external: true },
  { href: SOCIAL_LINKS.linkedin, label: "linkedin", external: true },
  { href: SOCIAL_LINKS.spotify, label: "spotify", external: true },
  { href: SOCIAL_LINKS.pinterest, label: "pinterest", external: true },
];

export default function HomeFooter() {
  return (
    <footer className="home-footer">
      <style>{`
        .home-footer {
          padding: var(--space-8) var(--space-5) var(--space-12);
        }
        .home-footer__row {
          max-width: 620px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: var(--space-2) var(--space-6);
        }
        .home-footer a {
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 400;
          letter-spacing: 0.08em;
          text-transform: lowercase;
          text-decoration: none;
          color: var(--color-fg-muted);
          transition: color var(--transition-base);
        }
        .home-footer a:hover { color: var(--color-fg); }
      `}</style>

      <div className="home-footer__row">
        {LINKS.map(({ href, label, external }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {label}
          </a>
        ))}
      </div>
    </footer>
  );
}
