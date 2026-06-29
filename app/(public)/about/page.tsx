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
    <>
      <style>{`
        .about-link { color: var(--color-fg); transition: color var(--transition-base); text-decoration: none; }
        .about-link:hover { color: var(--color-fg-secondary); }
      `}</style>

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-32) var(--space-8)",
          paddingBottom: "calc(var(--space-32) + 80px)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {[
              "Emil Lavinen is a Creative Director and Brand Strategist based in Helsinki. He works at the intersection of design, brand, and culture — shaping how ideas look, feel, and communicate.",
              "With a background spanning brand identity, art direction, and creative strategy, Emil collaborates with brands and organisations across Finland and Europe to build lasting visual languages and campaigns that connect.",
              "Available for selected projects and collaborations.",
            ].map((text) => (
              <p key={text.slice(0, 20)} style={{ fontSize: "var(--text-lg)", lineHeight: "var(--leading-relaxed)", color: "var(--color-fg)", margin: 0 }}>
                {text}
              </p>
            ))}
          </div>

          <dl
            style={{
              marginTop: "var(--space-32)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            {[
              { label: "Location", value: "Helsinki, Finland" },
              { label: "Role", value: "Creative Director & Brand Strategist" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", gap: "var(--space-12)" }}>
                <dt style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-widest)", textTransform: "uppercase", color: "var(--color-fg-muted)", width: "96px", flexShrink: 0 }}>
                  {label}
                </dt>
                <dd style={{ fontSize: "var(--text-sm)", color: "var(--color-fg)", margin: 0 }}>{value}</dd>
              </div>
            ))}
            <div style={{ display: "flex", gap: "var(--space-12)" }}>
              <dt style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-widest)", textTransform: "uppercase", color: "var(--color-fg-muted)", width: "96px", flexShrink: 0 }}>
                Contact
              </dt>
              <dd style={{ margin: 0 }}>
                <a
                  href={`mailto:${AUTHOR_EMAIL}`}
                  rel="noopener noreferrer"
                  className="about-link"
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  {AUTHOR_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  );
}
