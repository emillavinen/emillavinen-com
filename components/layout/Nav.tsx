"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/about", label: "ABOUT" },
  { href: "/blog", label: "BLOG" },
  { href: "#contact", label: "CONTACT" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleNavClick(href: string) {
    setOpen(false);
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }
  }

  const linkBase: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-sm)",
    fontWeight: 400,
    letterSpacing: "var(--tracking-widest)",
    textTransform: "uppercase",
    textDecoration: "none",
    color: "var(--color-fg-secondary)",
    transition: "color var(--transition-base)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  };

  return (
    <>
      <style>{`
        .nav-link:hover { color: var(--color-fg) !important; }
        .nav-overlay-link:hover { color: var(--color-fg-secondary) !important; }
      `}</style>

      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: "56px",
          background: "var(--color-bg)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <nav
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 var(--space-8)",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Wordmark */}
          <Link
            href="/"
            className="nav-link"
            style={{
              ...linkBase,
              color: "var(--color-fg-secondary)",
            }}
          >
            {SITE_NAME.toUpperCase()}
          </Link>

          {/* Desktop nav links */}
          <ul
            className="hidden md:flex"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              gap: "var(--space-8)",
            }}
          >
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                {href.startsWith("#") ? (
                  <button
                    onClick={() => handleNavClick(href)}
                    className="nav-link"
                    style={linkBase}
                  >
                    {label}
                  </button>
                ) : (
                  <Link
                    href={href}
                    className="nav-link"
                    style={linkBase}
                  >
                    {label}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Mobile toggle */}
          <button
            className="md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            style={{
              ...linkBase,
              minWidth: "44px",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              fontSize: "var(--text-xl)",
              color: "var(--color-fg-secondary)",
            }}
          >
            {open ? "×" : "≡"}
          </button>
        </nav>
      </header>

      {/* Mobile full-screen overlay */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-bg)",
          zIndex: 99,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-8)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity var(--transition-slow)",
        }}
      >
        {NAV_LINKS.map(({ href, label }) =>
          href.startsWith("#") ? (
            <button
              key={href}
              onClick={() => handleNavClick(href)}
              className="nav-overlay-link"
              style={{
                ...linkBase,
                fontSize: "var(--text-4xl)",
                letterSpacing: "var(--tracking-widest)",
                color: "var(--color-fg)",
                lineHeight: "var(--leading-tight)",
              }}
            >
              {label}
            </button>
          ) : (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="nav-overlay-link"
              style={{
                ...linkBase,
                fontSize: "var(--text-4xl)",
                letterSpacing: "var(--tracking-widest)",
                color: "var(--color-fg)",
                lineHeight: "var(--leading-tight)",
              }}
            >
              {label}
            </Link>
          )
        )}
      </div>
    </>
  );
}
