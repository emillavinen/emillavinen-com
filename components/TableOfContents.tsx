"use client";

import { useEffect, useRef, useState } from "react";
import type { TocItem } from "@/lib/toc";

interface Props {
  items: TocItem[];
  wordCount: number;
}

export default function TableOfContents({ items, wordCount }: Props) {
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  if (wordCount < 800 || items.length < 3) return null;

  useEffect(() => {
    const title = document.querySelector("article h1, [data-toc-title]") as HTMLElement | null;
    if (!title) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(title);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const headingEls = items
      .map((item) => document.getElementById(item.slug))
      .filter(Boolean) as HTMLElement[];

    if (headingEls.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length > 0) {
          setActiveSlug(intersecting[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );

    headingEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  function scrollTo(slug: string) {
    const el = document.getElementById(slug);
    if (!el) return;
    const offset = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    setMobileOpen(false);
  }

  const tocList = (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li
          key={item.slug}
          style={{
            paddingLeft: item.level === 3 ? "12px" : "0",
            marginBottom: "var(--space-2)",
          }}
        >
          <button
            onClick={() => scrollTo(item.slug)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textAlign: "left",
              fontFamily: "var(--font-sans)",
              fontSize: item.level === 2 ? "var(--text-sm)" : "var(--text-xs)",
              color: activeSlug === item.slug ? "var(--color-fg)" : "var(--color-fg-muted)",
              lineHeight: "var(--leading-snug)",
              letterSpacing: "var(--tracking-normal)",
            }}
          >
            {item.text}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div
        style={{
          display: "none",
          position: "fixed",
          top: "120px",
          right: "calc((100vw - 1200px) / 2 + 16px)",
          width: "200px",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s",
          pointerEvents: visible ? "auto" : "none",
        }}
        className="toc-desktop"
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-fg-muted)",
            marginBottom: "var(--space-3)",
          }}
        >
          In this post
        </p>
        {tocList}
      </div>

      {/* Mobile: inline collapsible */}
      <div className="toc-mobile" style={{ marginBottom: "var(--space-8)" }}>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-fg-muted)",
            marginBottom: mobileOpen ? "var(--space-3)" : 0,
          }}
        >
          Contents{" "}
          <span style={{ fontFamily: "monospace" }}>{mobileOpen ? "−" : "+"}</span>
        </button>
        {mobileOpen && tocList}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .toc-desktop { display: block !important; }
          .toc-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}
