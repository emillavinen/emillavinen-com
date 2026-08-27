"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkImage } from "@/lib/work";

interface LightboxProps {
  images: WorkImage[];
  /** Index to open on. */
  startIndex: number;
  /** Project title, announced as the dialog's name. */
  label: string;
  onClose: () => void;
}

/**
 * Fullscreen viewer for the posters in one project row.
 *
 * Opens on the image that was tapped and steps through that project's
 * images only — arrow keys, the on-screen arrows, or a horizontal swipe.
 * Closes on Escape, the close button, or a tap on the backdrop (but not
 * on the poster itself). Rendered through a portal so the fixed overlay
 * escapes the collapsed row's `overflow: hidden`.
 *
 * The arrows live in a bottom bar rather than over the poster's left and
 * right edges: a phone-width poster runs the full width of the screen,
 * and dark glyphs laid over the black poster were unreadable while a
 * light chip behind them punched a hole in the artwork.
 */
export default function Lightbox({ images, startIndex, label, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);

  const count = images.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count]
  );

  // Move focus into the dialog, and hand it back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // The page behind must not scroll while the overlay is up.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" && count > 1) go(1);
      else if (event.key === "ArrowLeft" && count > 1) go(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, go, onClose]);

  // Preload the neighbour so stepping through doesn't flash empty.
  useEffect(() => {
    if (count < 2) return;
    const next = new window.Image();
    next.src = images[(index + 1) % count].full;
  }, [images, index, count]);

  const current = images[index];

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0].clientX;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null || count < 2) return;
        const dx = event.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <style>{`
        .lightbox {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-12) var(--space-4) var(--space-6);
          background: var(--color-bg);
          animation: lightbox-in var(--transition-base);
        }
        @keyframes lightbox-in { from { opacity: 0; } to { opacity: 1; } }

        .lightbox__image {
          min-height: 0;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          cursor: default;
        }

        .lightbox__button {
          background: none;
          border: none;
          padding: var(--space-2) var(--space-3);
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          font-weight: 700;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-fg);
          transition: color var(--transition-base);
        }
        .lightbox__button:hover { color: var(--color-link); }

        .lightbox__close {
          position: absolute;
          top: var(--space-3);
          right: var(--space-3);
        }

        /* Prev / counter / next, centred under the poster. */
        .lightbox__bar {
          flex: none;
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .lightbox__arrow { font-size: var(--text-xl); }
        .lightbox__count {
          margin: 0;
          min-width: 4ch;
          text-align: center;
          font-family: var(--font-sans);
          font-size: var(--text-xs);
          letter-spacing: 0.08em;
          color: var(--color-fg-muted);
        }

        @media (max-width: 480px) {
          .lightbox { padding: var(--space-10) var(--space-2) var(--space-4); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lightbox { animation: none; }
        }
      `}</style>

      <button
        ref={closeRef}
        type="button"
        className="lightbox__button lightbox__close"
        onClick={onClose}
        aria-label="Close"
      >
        Close
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.full}
        className="lightbox__image"
        src={current.full}
        alt={current.alt}
        onClick={(event) => event.stopPropagation()}
      />

      {count > 1 && (
        <div className="lightbox__bar" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="lightbox__button lightbox__arrow"
            onClick={() => go(-1)}
            aria-label="Previous image"
          >
            &lsaquo;
          </button>
          <p className="lightbox__count">
            {index + 1} / {count}
          </p>
          <button
            type="button"
            className="lightbox__button lightbox__arrow"
            onClick={() => go(1)}
            aria-label="Next image"
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
