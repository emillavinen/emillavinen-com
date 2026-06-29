import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Emil Lavinen — Creative Director & Brand Strategist, Helsinki",
  description:
    "Emil Lavinen is a Creative Director and Brand Strategist based in Helsinki. He leads creative direction, builds brand identities, and develops visual languages for organisations across Finland and Europe.",
  alternates: {
    canonical: "https://emillavinen.com",
  },
  openGraph: {
    title: "Emil Lavinen — Creative Director & Brand Strategist, Helsinki",
    description:
      "Emil Lavinen is a Creative Director and Brand Strategist based in Helsinki. He leads creative direction, builds brand identities, and develops visual languages for organisations across Finland and Europe.",
    url: "https://emillavinen.com",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Emil Lavinen",
  jobTitle: ["Creative Director", "Brand Strategist"],
  url: "https://emillavinen.com",
  email: "emil.lavinen@gmail.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Helsinki",
    addressCountry: "FI",
  },
  knowsAbout: [
    "Creative Direction",
    "Brand Strategy",
    "Brand Identity",
    "Art Direction",
    "Visual Design",
  ],
  sameAs: [
    "https://www.linkedin.com/in/emillavinen",
    "https://www.instagram.com/emillavinen",
    "https://www.behance.net/emillavinen",
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="max-w-4xl mx-auto px-8 py-32">
        <h1 className="text-5xl font-light tracking-tight leading-tight mb-4">
          Emil Lavinen
        </h1>
        <h2 className="text-sm tracking-widest uppercase text-neutral-400 mb-10">
          Creative Director &amp; Brand Strategist — Helsinki
        </h2>
        <p className="text-xl text-neutral-500 max-w-xl leading-relaxed mb-12">
          I lead creative direction and brand strategy for organisations across
          Finland and Europe — building identities, visual languages, and
          campaigns that connect.
        </p>
        <div className="flex gap-8">
          <Link
            href="/projects"
            className="text-sm tracking-widest uppercase border-b border-black pb-0.5 hover:opacity-50 transition-opacity"
          >
            Projects
          </Link>
          <Link
            href="/about"
            className="text-sm tracking-widest uppercase border-b border-black pb-0.5 hover:opacity-50 transition-opacity"
          >
            About
          </Link>
          <Link
            href="/blog"
            className="text-sm tracking-widest uppercase border-b border-black pb-0.5 hover:opacity-50 transition-opacity"
          >
            Writing
          </Link>
        </div>
      </section>
    </>
  );
}
