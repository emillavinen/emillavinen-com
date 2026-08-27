"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkMedia } from "@/lib/work";

interface WorkThumbProps {
  media: WorkMedia;
  /** Whether the row this sits in is currently open. */
  active: boolean;
  onOpen: () => void;
}

/**
 * One cell in a project's media grid — a still, or a silent looping cut
 * of a motion piece. Either way, clicking it opens the fullscreen viewer.
 *
 * A video cell is the poster frame with the video layered over it, and
 * the video is only faded in once it reports that it is actually
 * playing. That way every not-playing case shows the poster rather than
 * the video's own first frame — which for this animation is black, so
 * the cell would otherwise read as an empty box. The cases: the row is
 * closed, the viewer prefers reduced motion, or the browser refused
 * autoplay (iOS Low Power Mode, data saver). Tying the swap to the
 * `playing` event rather than to our own play() call keeps it honest —
 * play() resolving is not the same as frames reaching the screen.
 *
 * The video also carries `preload="none"`: a collapsed row is
 * zero-height and inert, so nothing is fetched for a project nobody has
 * opened. The loop pauses and rewinds when its row closes, so a closed
 * row is never quietly decoding video off-screen.
 */
export default function WorkThumb({ media, active, onOpen }: WorkThumbProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const stillWanted =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (active && !stillWanted) {
      // Permitted only because the element is muted.
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  return (
    <button type="button" className="work__thumb" onClick={onOpen} aria-label={`View full screen: ${media.alt}`}>
      {media.kind === "video" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.poster} alt={media.alt} width={800} height={1020} decoding="async" />
          <video
            ref={videoRef}
            className={playing ? "is-playing" : undefined}
            src={media.src}
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
            aria-hidden="true"
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        </>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media.src}
          alt={media.alt}
          width={800}
          height={1020}
          decoding="async"
          fetchPriority="low"
        />
      )}
    </button>
  );
}
