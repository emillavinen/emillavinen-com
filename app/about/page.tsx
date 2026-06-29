import type { Metadata } from "next";
import Container from "@/components/Container";

export const metadata: Metadata = {
  title: "About",
  description:
    "Emil Lavinen is a Creative Director based in Helsinki, with a background in design, brand strategy, and art direction.",
  openGraph: {
    title: "About — Emil Lavinen",
    description:
      "Emil Lavinen is a Creative Director based in Helsinki, with a background in design, brand strategy, and art direction.",
    url: "https://emillavinen.com/about",
  },
};

export default function AboutPage() {
  return (
    <Container>
      <div className="max-w-xl">
        <h1 className="text-3xl font-light tracking-tight mb-12">About</h1>
        <div className="space-y-6 text-neutral-600 leading-relaxed">
          <p>
            Emil Lavinen is a Creative Director based in Helsinki. He works at
            the intersection of design, brand, and culture — shaping how ideas
            look, feel, and communicate.
          </p>
          <p>
            With a background spanning brand identity, art direction, and
            creative strategy, Emil collaborates with brands and organisations
            to build lasting visual languages.
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
              <dd className="text-sm">Creative Director</dd>
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
