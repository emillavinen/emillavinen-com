import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Emil Lavinen — Creative Director",
  description:
    "Emil Lavinen is a Creative Director based in Helsinki, working at the intersection of design, brand, and culture.",
  openGraph: {
    title: "Emil Lavinen — Creative Director",
    description:
      "Emil Lavinen is a Creative Director based in Helsinki, working at the intersection of design, brand, and culture.",
    url: "https://emillavinen.com",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Emil Lavinen",
  jobTitle: "Creative Director",
  url: "https://emillavinen.com",
  email: "emil.lavinen@gmail.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Helsinki",
    addressCountry: "FI",
  },
  sameAs: [],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="max-w-4xl mx-auto px-8 py-32">
        <h1 className="text-5xl font-light tracking-tight leading-tight mb-8">
          Emil Lavinen
        </h1>
        <p className="text-xl text-neutral-500 max-w-xl leading-relaxed mb-12">
          Creative Director based in Helsinki, working at the intersection of
          design, brand, and culture.
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
        </div>
      </section>
    </>
  );
}
