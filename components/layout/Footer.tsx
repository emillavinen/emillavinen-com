import { SITE_NAME } from "@/lib/constants";

export default function Footer() {
  return (
    <footer
      style={{
        fontFamily: "var(--font-sans)",
        marginBottom: "40px",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-8) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-fg-muted)", margin: 0 }}>
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
        <p style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-fg-muted)", margin: 0 }}>
          Helsinki, Finland
        </p>
      </div>
    </footer>
  );
}
