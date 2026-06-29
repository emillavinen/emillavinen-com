import { SITE_NAME } from "@/lib/constants";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        fontFamily: "var(--font-sans)",
        marginBottom: "44px", /* clear the fixed ContactBar */
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-6) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", margin: 0 }}>
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", margin: 0 }}>
          Helsinki, Finland
        </p>
      </div>
    </footer>
  );
}
