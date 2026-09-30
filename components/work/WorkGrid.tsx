import Link from "next/link";
import { displayYear, masonry, type GalleryWork } from "@/lib/dispatch/site";

/**
 * The portfolio grid on /work. Masonry, true aspect ratios, nothing cropped.
 *
 * Column assignment is computed on the server for two, three and four
 * columns, and CSS shows the one that fits the viewport. Every image
 * carries its width and height, so the page never shifts as images arrive,
 * and the hidden layouts cost nothing: lazy images inside `display: none`
 * are never fetched.
 *
 * No card chrome: an image and one quiet line under it — title left, year
 * right — echoing the rows of the homepage work list.
 */
const LAYOUTS = [2, 3, 4] as const;

export default function WorkGrid({ works }: { works: GalleryWork[] }) {
  const ratio = (w: GalleryWork) => w.images[0].height / w.images[0].width;

  return (
    <div className="grid-wrap">
      <style>{`
        .grid-wrap {
          max-width: 1600px;
          margin: 0 auto;
          padding: var(--space-12) var(--space-5) var(--space-24);
        }
        .grid { display: none; gap: var(--space-4); align-items: flex-start; }
        .grid--2 { display: flex; }
        .grid__col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: var(--space-8); }

        @media (min-width: 720px) {
          .grid-wrap { padding: var(--space-16) var(--space-8) var(--space-32); }
          .grid { gap: var(--space-8); }
          .grid__col { gap: var(--space-12); }
          .grid--2 { display: none; }
          .grid--3 { display: flex; }
        }
        @media (min-width: 1180px) {
          .grid--3 { display: none; }
          .grid--4 { display: flex; }
        }

        .tile { display: block; text-decoration: none; color: var(--color-fg-muted); }
        .tile img {
          display: block;
          width: 100%;
          height: auto;
          background: var(--color-bg-secondary);
          transition: opacity var(--transition-base);
        }
        .tile:hover img { opacity: 0.82; }
        .tile__meta {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: var(--space-3);
          margin-top: var(--space-2);
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          font-weight: 400;
          line-height: 1.3;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          transition: color var(--transition-base);
        }
        .tile:hover .tile__meta { color: var(--color-fg); }
        .tile__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tile__year { flex-shrink: 0; }

        .grid-empty {
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          letter-spacing: var(--tracking-wide);
          color: var(--color-fg-muted);
          text-transform: lowercase;
        }
      `}</style>

      {works.length === 0 ? (
        <p className="grid-empty">no work here yet.</p>
      ) : (
        LAYOUTS.map((n) => (
          <div key={n} className={`grid grid--${n}`}>
            {masonry(works, n, ratio).map((column, i) => (
              <div key={i} className="grid__col">
                {column.map((work) => {
                  const cover = work.images[0];
                  return (
                    <Link key={work.id} href={`/work/${work.slug}`} className="tile">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover.thumbUrl}
                        alt={cover.alt}
                        width={cover.width}
                        height={cover.height}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="tile__meta">
                        <span className="tile__title">{work.title}</span>
                        <span className="tile__year">{displayYear(work)}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
