"use client";

import { useEffect, useRef } from "react";
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
 * A video carries `preload="none"`: a collapsed row is zero-height and
 * inert, so nothing should be fetched for a project nobody has opened.
 * The loop starts when the row opens and is paused and rewound when it
 * closes, so a closed row is never quietly decoding video off-screen.
 */
export default function WorkThumb({ media, active, onOpen }: WorkThumbProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (active) {
      // Autoplay is only permitted because the element is muted; a
      // rejection here just leaves the poster frame showing.
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  return (
    <button type="button" className="work__thumb" onClick={onOpen} aria-label={`View full screen: ${media.alt}`}>
      {media.kind === "video" ? (
        <video
          ref={videoRef}
          src={media.src}
          poster={media.poster}
          muted
          loop
          playsInline
          preload="none"
          tabIndex={-1}
          aria-label={media.alt}
        />
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
