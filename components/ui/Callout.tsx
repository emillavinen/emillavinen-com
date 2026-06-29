interface CalloutProps {
  children: React.ReactNode;
}

export default function Callout({ children }: CalloutProps) {
  return (
    <aside
      style={{
        borderLeft: "3px solid var(--color-fg)",
        background: "#f9f9f9",
        padding: "var(--space-5) var(--space-6)",
        margin: "var(--space-8) 0",
        borderRadius: "0 var(--radius-md) var(--radius-md) 0",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-base)",
        lineHeight: 1.7,
        color: "var(--color-fg)",
      }}
    >
      {children}
    </aside>
  );
}
