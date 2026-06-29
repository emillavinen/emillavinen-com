import type { Metadata } from "next";
import Container from "@/components/Container";

export const metadata: Metadata = {
  title: "About Emil Lavinen — Creative Director & Brand Strategist",
  description:
    "Emil Lavinen is a Helsinki-based Creative Director and Brand Strategist with a background in brand identity, art direction, and creative strategy. Available for selected projects across Finland and Europe.",
  alternates: {
    canonical: "https://emillavinen.com/about",
  },
  openGraph: {
    title: "About Emil Lavinen — Creative Director & Brand Strategist",
    description:
      "Emil Lavinen is a Helsinki-based Creative Director and Brand Strategist with a background in brand identity, art direction, and creative strategy.",
    url: "https://emillavinen.com/about",
  },
};

export default function AboutPage() {
  return (
    <Container>
      <div className="max-w-xl">
        <h1 className="text-3xl font-light tracking-tight mb-12">
          About Emil Lavinen
        </h1>
        <div className="space-y-6 text-neutral-600 leading-relaxed">
          <p>
            Emil Lavinen is a Creative Director and Brand Strategist based in
            Helsinki. He works at the intersection of design, brand, and culture
            — shaping how ideas look, feel, and communicate.
          </p>
          <p>
            With a background spanning brand identity, art direction, and
            creative strategy, Emil collaborates with brands and organisations
            across Finland and Europe to build lasting visual languages and
            campaigns that connect.
          </p>
          <p>Available for selected projects and collaborations.</p>
        </div>
        <div className="mt-16 pt-8 border-t border-neutral-200">
          <dl className="space-y-4">
            <div className="flex gap-16">
              <dt className="text-xs tracking-widest uppercase text-neutral-400 w-24 shrink-0">
                Location
              </dt>
              <dd className="text-sm">Helsinki, Finland</dd>
            </div>
            <div className="flex gap-16">
              <dt className="text-xs tracking-widest uppercase text-neutral-400 w-24 shrink-0">
                Role
              </dt>
              <dd className="text-sm">Creative Director &amp; Brand Strategist</dd>
            </div>
            <div className="flex gap-16">
              <dt className="text-xs tracking-widest uppercase text-neutral-400 w-24 shrink-0">
                Contact
              </dt>
              <dd className="text-sm">
                <a
                  href="mailto:emil.lavinen@gmail.com"
                  className="hover:opacity-50 transition-opacity"
                >
                  emil.lavinen@gmail.com
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Container>
  );
}
