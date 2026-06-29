import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { AUTHOR_EMAIL } from "@/lib/constants";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Emil Lavinen is a Helsinki-based Creative Director and Brand Strategist with a background in brand identity, art direction, and creative strategy.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "var(--space-16) var(--space-8)",
        paddingBottom: "calc(var(--space-16) + 44px)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ maxWidth: "680px" }}>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: 300,
            letterSpacing: "-0.01em",
            margin: "0 0 var(--space-12)",
            color: "var(--color-fg)",
          }}
        >
          About
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <p style={{ fontSize: "var(--text-base)", lineHeight: 1.75, color: "var(--color-muted)", margin: 0 }}>
            Emil Lavinen is a Creative Director and Brand Strategist based in
            Helsinki. He works at the intersection of design, brand, and culture
            — shaping how ideas look, feel, and communicate.
          </p>
          <p style={{ fontSize: "var(--text-base)", lineHeight: 1.75, color: "var(--color-muted)", margin: 0 }}>
            With a background spanning brand identity, art direction, and
            creative strategy, Emil collaborates with brands and organisations
            across Finland and Europe to build lasting visual languages and
            campaigns that connect.
          </p>
          <p style={{ fontSize: "var(--text-base)", lineHeight: 1.75, color: "var(--color-muted)", margin: 0 }}>
            Available for selected projects and collaborations.
          </p>
        </div>

        <div
          style={{
            marginTop: "var(--space-16)",
            paddingTop: "var(--space-8)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <dl style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {[
              { label: "Location", value: "Helsinki, Finland" },
              { label: "Role",     value: "Creative Director & Brand Strategist" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", gap: "var(--space-12)" }}>
                <dt style={{ fontSize: "var(--text-xs)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted)", width: "96px", flexShrink: 0 }}>
                  {label}
                </dt>
                <dd style={{ fontSize: "var(--text-sm)", color: "var(--color-fg)", margin: 0 }}>{value}</dd>
              </div>
            ))}
            <div style={{ display: "flex", gap: "var(--space-12)" }}>
              <dt style={{ fontSize: "var(--text-xs)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted)", width: "96px", flexShrink: 0 }}>
                Contact
              </dt>
              <dd style={{ margin: 0 }}>
                <a
                  href={`mailto:${AUTHOR_EMAIL}`}
                  rel="noopener noreferrer"
                  style={{ fontSize: "var(--text-sm)", color: "var(--color-fg)", textDecoration: "none", transition: "opacity var(--transition-base)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.5")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {AUTHOR_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
