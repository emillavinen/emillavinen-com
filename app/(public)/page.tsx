import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_ALL_URLS, AUTHOR_EMAIL } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import BackgroundText from "@/components/ui/BackgroundText";

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
};

export default function HomePage() {
  return (
    <>
      <BackgroundText src="/background-text/about-me-white.svg" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "var(--space-32) var(--space-8)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              letterSpacing: "var(--tracking-widest)",
              color: "var(--color-fg)",
              margin: "0 0 var(--space-24)",
            }}
          >
            I design; analyze; direct
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {[
              "At 16, I realized my future belonged in the creative field. Leaving my dream to become a pilot behind, the next four years I spent in a home studio, learning music production and the business around it. By 17 I got my first clients. By 19, customers were coming back on their own.",
              "Those years revealed a pattern I kept running into: people who excelled at making wonderful things often approached the work differently from those who knew how to bring things into the world. I became interested in turning good work into work that gets seen.",
            ].map((text) => (
              <p key={text.slice(0, 20)} style={{ fontSize: "var(--text-lg)", lineHeight: "var(--leading-relaxed)", color: "var(--color-fg-secondary)", margin: 0 }}>
                {text}
              </p>
            ))}
          </div>

          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              letterSpacing: "var(--tracking-widest)",
              color: "var(--color-fg)",
              margin: "var(--space-32) 0 var(--space-6)",
            }}
          >
            The direction
          </h2>

          <p style={{ fontSize: "var(--text-lg)", lineHeight: "var(--leading-relaxed)", color: "var(--color-fg-secondary)", margin: 0 }}>
            Between 18 and 20, as part of a niche indie label, a handful of us built one of the largest annual gatherings for Helsinki&rsquo;s Russian-speaking audience. I was there as an artist and a graphic designer. Every year we organized festivals for 150+ people, with artists from abroad.
          </p>
          <p style={{ fontSize: "var(--text-lg)", lineHeight: "var(--leading-relaxed)", color: "var(--color-fg-secondary)", margin: "var(--space-6) 0 0" }}>
            We also barely broke even. The whole thing ran on money borrowed from friends, year after year, despite the demand being real and the work being good. That much creative energy in one place is part of why we pulled it off at all, and it&rsquo;s still one of the best experiences I&rsquo;ve had. It&rsquo;s also what made the gap impossible to ignore: creative businesses compete on the same ground as everyone else. There&rsquo;s no sustained creativity without the business side.
          </p>

          <h2
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              letterSpacing: "var(--tracking-widest)",
              color: "var(--color-fg)",
              margin: "var(--space-32) 0 var(--space-6)",
            }}
          >
            The work
          </h2>

          <p style={{ fontSize: "var(--text-lg)", lineHeight: "var(--leading-relaxed)", color: "var(--color-fg-secondary)", margin: 0 }}>
            I currently work at a Finnish product and design atelier. I came in as an intern myself, part of a team like any other. Fast forward and I am teaching and directing just arriving interns, and I think I&rsquo;ve gotten a taste for it.
          </p>

          <p
            style={{
              fontSize: "var(--text-lg)",
              lineHeight: "var(--leading-relaxed)",
              fontWeight: 700,
              color: "var(--color-fg-secondary)",
              margin: "var(--space-32) 0 0",
            }}
          >
            There is one project I haven&rsquo;t made yet.{" "}
            <a
              href={`mailto:${AUTHOR_EMAIL}`}
              style={{ color: "var(--color-link)", textDecoration: "underline" }}
            >
              Contact me.
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
