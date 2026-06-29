"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "#contact", label: "Contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleNavClick(href: string) {
    setOpen(false);
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <nav
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-5) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-fg)",
            textDecoration: "none",
          }}
        >
          {SITE_NAME}
        </Link>

        {/* Desktop links */}
        <ul
          className="hidden md:flex"
          style={{ gap: "var(--space-8)", listStyle: "none", margin: 0, padding: 0 }}
        >
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              {href.startsWith("#") ? (
                <button
                  onClick={() => handleNavClick(href)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                    letterSpacing: "0.05em",
                    color: "var(--color-fg)",
                    transition: "opacity var(--transition-base)",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.4")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {label}
                </button>
              ) : (
                <Link
                  href={href}
                  style={{
                    fontSize: "var(--text-sm)",
                    letterSpacing: "0.05em",
                    color: "var(--color-fg)",
                    textDecoration: "none",
                    transition: "opacity var(--transition-base)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.4")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        {/* Hamburger button */}
        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "var(--space-2)",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            minWidth: "44px",
            minHeight: "44px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              display: "block",
              width: "22px",
              height: "1px",
              background: "var(--color-fg)",
              transition: "transform var(--transition-base), opacity var(--transition-base)",
              transform: open ? "translateY(6px) rotate(45deg)" : "none",
            }}
          />
          <span
            style={{
              display: "block",
              width: "22px",
              height: "1px",
              background: "var(--color-fg)",
              transition: "opacity var(--transition-base)",
              opacity: open ? 0 : 1,
            }}
          />
          <span
            style={{
              display: "block",
              width: "22px",
              height: "1px",
              background: "var(--color-fg)",
              transition: "transform var(--transition-base), opacity var(--transition-base)",
              transform: open ? "translateY(-6px) rotate(-45deg)" : "none",
            }}
          />
        </button>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          inset: 0,
          top: "61px",
          background: "var(--color-bg)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          padding: "var(--space-8)",
          gap: "var(--space-6)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity var(--transition-base)",
        }}
      >
        {NAV_LINKS.map(({ href, label }) => (
          href.startsWith("#") ? (
            <button
              key={href}
              onClick={() => handleNavClick(href)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--text-2xl)",
                fontWeight: 300,
                color: "var(--color-fg)",
                textAlign: "left",
                padding: 0,
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </button>
          ) : (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 300,
                color: "var(--color-fg)",
                textDecoration: "none",
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </Link>
          )
        ))}
      </div>
    </header>
  );
}
