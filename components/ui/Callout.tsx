interface CalloutProps {
  children: React.ReactNode;
}

export default function Callout({ children }: CalloutProps) {
  return (
    <aside
      style={{
        borderLeft: "2px solid var(--color-fg)",
        paddingLeft: "var(--space-6)",
        margin: "var(--space-8) 0",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-base)",
        lineHeight: "var(--leading-relaxed)",
        color: "var(--color-fg-secondary)",
        fontStyle: "italic",
      }}
    >
      {children}
    </aside>
  );
}
