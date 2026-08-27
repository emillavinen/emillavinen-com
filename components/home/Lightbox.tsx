"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkMedia } from "@/lib/work";

interface LightboxProps {
  media: WorkMedia[];
  /** Index to open on. */
  startIndex: number;
  /** Project title, announced as the dialog's name. */
  label: string;
  onClose: () => void;
}

/**
 * Fullscreen viewer for the media in one project row.
 *
 * Opens on the item that was tapped and steps through that project's
 * media only — arrow keys, the on-screen arrows, or a horizontal swipe.
 * Closes on Escape, the close button, or a tap on the backdrop (but not
 * on the media itself). Rendered through a portal so the fixed overlay
 * escapes the collapsed row's `overflow: hidden`.
 *
 * A video plays here at full resolution with its sound, unlike the
 * silent loop in the grid. Autoplay with audio is allowed because
 * opening the viewer is itself a user gesture; browsers that refuse it
 * anyway fall back to muted playback, and the controls let the viewer
 * unmute.
 *
 * The arrows live in a bottom bar rather than over the media's left and
 * right edges: a phone-width poster runs the full width of the screen,
 * where dark glyphs were unreadable against the black poster and a
 * light chip behind them punched a hole in the artwork.
 */
export default function Lightbox({ media, startIndex, label, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);

  const count = media.length;
  const current = media[index];
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

  // Start the video with sound; if the browser blocks that, mute and
  // play rather than leaving the viewer looking at a frozen frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Let the video's own controls own the arrow keys once it has focus,
      // so seeking still works.
      if (event.target instanceof HTMLVideoElement) return;
      if (count < 2) return;
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, go, onClose]);

  // Preload the neighbour still so stepping through doesn't flash empty.
  // Videos are left alone — they are far too big to fetch speculatively.
  useEffect(() => {
    if (count < 2) return;
    const next = media[(index + 1) % count];
    if (next.kind !== "image") return;
    const preloaded = new window.Image();
    preloaded.src = next.full;
  }, [media, index, count]);

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

        .lightbox__media {
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

        /* Prev / counter / next, centred under the media. */
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

      {current.kind === "video" ? (
        <video
          key={current.full}
          ref={videoRef}
          className="lightbox__media"
          src={current.full}
          poster={current.poster}
          controls
          loop
          playsInline
          preload="auto"
          aria-label={current.alt}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={current.full}
          className="lightbox__media"
          src={current.full}
          alt={current.alt}
          onClick={(event) => event.stopPropagation()}
        />
      )}

      {count > 1 && (
        <div className="lightbox__bar" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="lightbox__button lightbox__arrow"
            onClick={() => go(-1)}
            aria-label="Previous"
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
            aria-label="Next"
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
