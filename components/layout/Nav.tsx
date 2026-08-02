"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BACKGROUND_TEXT_BY_PATH } from "@/lib/constants";

export default function Nav() {
  const pathname = usePathname();
  const backgroundTextSrc = BACKGROUND_TEXT_BY_PATH[pathname];

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: "56px",
        fontFamily: "var(--font-sans)",
        backgroundColor: "var(--color-bg)",
        ...(backgroundTextSrc && {
          backgroundImage: `url(${backgroundTextSrc})`,
          backgroundSize: "100vw 100vh",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
        }),
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
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            textDecoration: "underline",
            color: "var(--color-link-secondary)",
          }}
          className="nav-wordmark"
        >
          <img src="/logo.svg" alt="" width={24} height={24} />
          emil lavinen
        </Link>
      </nav>

      <style>{`
        .nav-wordmark:hover { color: var(--color-fg) !important; }
      `}</style>
    </header>
  );
}
