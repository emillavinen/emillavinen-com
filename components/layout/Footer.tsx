export default function Footer() {
  return (
    <footer
      style={{
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-8) var(--space-8) var(--space-4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", color: "var(--color-fg-muted)", margin: 0, textTransform: "uppercase" }}>
          © {new Date().getFullYear()} emil lavinen
        </p>
        <p style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", color: "var(--color-fg-muted)", margin: 0, textTransform: "uppercase" }}>
          helsinki
        </p>
      </div>
    </footer>
  );
}
