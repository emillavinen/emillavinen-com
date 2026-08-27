"use client";

import { useState } from "react";
import { WORK } from "@/lib/work";

/**
 * The homepage list: one row per project, title left and year right, each
 * row opening to reveal its images and copy. Accordion — opening a row
 * closes whichever row was open, clicking an open row closes it.
 *
 * The open/close animation uses the `grid-template-rows: 0fr -> 1fr`
 * technique rather than animating `max-height` to a guessed pixel cap, so
 * a row expands to exactly its own height no matter how tall the images
 * or how far the copy reflows at narrow widths.
 */
export default function WorkList() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="work">
      <style>{`
        .work {
          max-width: 620px;
          margin: 0 auto;
          padding: var(--space-16) var(--space-5) var(--space-24);
        }

        .work__header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: var(--space-4);
          width: 100%;
          padding: var(--space-3) 0 var(--space-5);
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          -webkit-user-select: none;
          user-select: none;
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-fg);
          transition: color var(--transition-base);
        }
        .work__header:hover { color: var(--color-link); }

        .work__year {
          flex: 1;
          min-width: 0;
          text-align: right;
          white-space: nowrap;
        }

        /* Collapsed: the content row has zero height but keeps its own
           intrinsic size, so the transition to 1fr resolves to auto. */
        .work__content {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows var(--transition-slow);
        }
        .work__content.is-open { grid-template-rows: 1fr; }
        .work__inner {
          overflow: hidden;
          /* Grid items default to min-height:auto, which would refuse to
             shrink below the content's min-content height and leave the
             collapsed row leaking a sliver of the poster. */
          min-height: 0;
        }

        .work__images {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        .work__images img {
          display: block;
          width: 100%;
          height: auto;
          aspect-ratio: 4 / 5;
          object-fit: cover;
          background: var(--color-bg-secondary);
        }

        .work__text p {
          margin: 0 0 var(--space-4);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 400;
          line-height: var(--leading-normal);
          text-align: justify;
          text-align-last: left;
          color: var(--color-fg-secondary);
        }
        .work__text p:last-child { margin-bottom: var(--space-2); }

        .work__placeholder {
          margin: 0 0 var(--space-2);
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 400;
          line-height: var(--leading-normal);
          color: var(--color-fg-muted);
        }

        @media (prefers-reduced-motion: reduce) {
          .work__content { transition: none; }
        }
      `}</style>

      {WORK.map((project) => {
        const isOpen = openId === project.id;
        const panelId = `work-panel-${project.id}`;

        return (
          <div key={project.id} className="work__item">
            <button
              type="button"
              className="work__header"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : project.id)}
            >
              <span>{project.title}</span>
              <span className="work__year">{project.year}</span>
            </button>

            <div
              id={panelId}
              className={`work__content${isOpen ? " is-open" : ""}`}
              role="region"
              aria-label={project.title}
            >
              <div className="work__inner" inert={!isOpen}>
                {project.images && (
                  <div className="work__images">
                    {project.images.map((image) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={image.src}
                        src={image.src}
                        alt={image.alt}
                        width={800}
                        height={1000}
                        decoding="async"
                        fetchPriority="low"
                      />
                    ))}
                  </div>
                )}

                {project.body && (
                  <div className="work__text">
                    {project.body.map((paragraph) => (
                      <p key={paragraph.slice(0, 24)}>{paragraph}</p>
                    ))}
                  </div>
                )}

                {!project.body && project.placeholder && (
                  <p className="work__placeholder">{project.placeholder}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
