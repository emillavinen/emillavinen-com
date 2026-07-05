import Link from "next/link";

export default function Nav() {
  return (
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
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-widest)",
            textDecoration: "none",
            color: "var(--color-fg-secondary)",
          }}
          className="nav-wordmark"
        >
          emil lavinen
        </Link>
      </nav>

      <style>{`
        .nav-wordmark:hover { color: var(--color-fg) !important; }
      `}</style>
    </header>
  );
}
