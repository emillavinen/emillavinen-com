import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_ALL_URLS, AUTHOR_EMAIL } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata();

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE_NAME,
  jobTitle: "Creative Director",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  email: AUTHOR_EMAIL,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Helsinki",
    addressCountry: "FI",
  },
  sameAs: SOCIAL_ALL_URLS,
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/blog?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: "calc(100svh - 62px)",
          display: "flex",
          alignItems: "center",
          padding: "var(--space-16) var(--space-8)",
          maxWidth: "1200px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
        className="min-h-[80svh] md:min-h-[calc(100svh-62px)]"
      >
        <div style={{ maxWidth: "720px" }}>
          <h1
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: "0 0 var(--space-4)",
              color: "var(--color-fg)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Emil Lavinen
          </h1>

          <p
            style={{
              fontSize: "var(--text-sm)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              margin: "0 0 var(--space-10)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Creative Director &amp; Brand Strategist — Helsinki
          </p>

          <p
            style={{
              fontSize: "var(--text-xl)",
              lineHeight: 1.65,
              color: "var(--color-muted)",
              maxWidth: "560px",
              margin: 0,
              fontFamily: "var(--font-sans)",
            }}
          >
            I work at the intersection of visual identity and brand strategy —
            building the creative systems that give organisations a clear,
            coherent presence. Based in Helsinki, I lead art direction and
            brand work for clients across Finland and Europe, with a particular
            interest in music culture and the brands that shape it.
          </p>
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────────────── */}
      <section
        id="about"
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "var(--space-16) var(--space-8)",
          paddingBottom: "calc(var(--space-16) + 44px)", /* clear ContactBar */
          maxWidth: "1200px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "var(--space-10)",
            maxWidth: "680px",
          }}
          className="md:grid-cols-[160px_1fr]"
        >
          <p
            style={{
              fontSize: "var(--text-xs)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              margin: 0,
              paddingTop: "var(--space-1)",
              fontFamily: "var(--font-sans)",
            }}
          >
            About
          </p>

          <div>
            <p
              style={{
                fontSize: "var(--text-base)",
                lineHeight: 1.75,
                color: "var(--color-fg)",
                margin: 0,
                fontFamily: "var(--font-sans)",
              }}
            >
              I&rsquo;ve spent the better part of a decade helping organisations
              figure out who they are and how to show it. That work lives at
              the overlap of strategy and craft — defining what a brand stands
              for, then building the visual language that makes it legible.
              I&rsquo;m drawn to projects where the brief is hard and the
              stakes are real: identity systems, campaign direction, brand
              architecture for organisations navigating change. Music culture
              runs through a lot of it. Helsinki is home.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
