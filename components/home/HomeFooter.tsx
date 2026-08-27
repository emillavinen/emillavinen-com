import Link from "next/link";
import { SOCIAL_LINKS } from "@/lib/constants";

/**
 * Homepage footer — one centered row of small links, replacing the
 * Footer + ContactBar pair the other public routes use. Keeps the contact
 * routes and the blog reachable from a page that is otherwise just the
 * wordmark and the work list.
 */
const LINKS = [
  { href: SOCIAL_LINKS.email, label: "Email", external: false },
  { href: SOCIAL_LINKS.instagram, label: "Instagram", external: true },
  { href: SOCIAL_LINKS.behance, label: "Behance", external: true },
  { href: SOCIAL_LINKS.linkedin, label: "LinkedIn", external: true },
  { href: SOCIAL_LINKS.spotify, label: "Spotify", external: true },
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
          text-transform: uppercase;
          text-decoration: none;
          color: var(--color-fg-muted);
          transition: color var(--transition-base);
        }
        .home-footer a:hover { color: var(--color-fg); }
      `}</style>

      <div className="home-footer__row">
        <Link href="/blog">Writing</Link>
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
