import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_ALL_URLS, AUTHOR_EMAIL } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import Testimonials from "@/components/Testimonials";

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

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "flex-start",
          padding: "clamp(var(--space-32), 34svh, var(--space-48)) var(--space-8) var(--space-32)",
          maxWidth: "1200px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(3rem, 8vw, 8rem)",
              fontWeight: 400,
              letterSpacing: "var(--tracking-tight)",
              lineHeight: "var(--leading-tight)",
              margin: 0,
              color: "var(--color-fg)",
            }}
          >
            Emil Lavinen
          </h1>

          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: 400,
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              color: "var(--color-fg-secondary)",
              margin: 0,
            }}
          >
            Creative Director &amp; Brand Strategist — Helsinki
          </p>

          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-base)",
              lineHeight: "var(--leading-relaxed)",
              color: "var(--color-fg-secondary)",
              maxWidth: "520px",
              margin: "var(--space-12) 0 0",
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

      {/* ── About ────────────────────────────────────────────────────────── */}
      <section
        id="about"
        style={{
          paddingTop: "var(--space-40)",
          paddingBottom: "calc(var(--space-32) + 80px)",
          paddingLeft: "var(--space-8)",
          paddingRight: "var(--space-8)",
          maxWidth: "1200px",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-lg)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--color-fg)",
            maxWidth: "600px",
            margin: 0,
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

        <div style={{ maxWidth: "680px", marginTop: "var(--space-24)" }}>
          <Testimonials />
        </div>
      </section>
    </>
  );
}
