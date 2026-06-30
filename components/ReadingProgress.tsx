"use client";

import { useEffect, useRef, useState } from "react";

export default function ReadingProgress({ articleRef }: { articleRef: React.RefObject<HTMLElement | null> }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function update() {
      const article = articleRef.current;
      if (!article) return;

      const top = article.getBoundingClientRect().top + window.scrollY;
      const height = article.offsetHeight;
      const scrolled = window.scrollY - top;
      const pct = Math.min(100, Math.max(0, (scrolled / height) * 100));
      setProgress(pct);
    }

    function onScroll() {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [articleRef]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "2px",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "var(--color-fg)",
          opacity: progress > 0 && progress < 100 ? 1 : 0,
        }}
      />
    </div>
  );
}
