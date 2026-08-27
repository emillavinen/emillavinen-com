import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_ALL_URLS, AUTHOR_EMAIL } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { WORK } from "@/lib/work";
import BackgroundText from "@/components/ui/BackgroundText";
import WorkList from "@/components/home/WorkList";

const homeMetadata = buildMetadata({ description: "I DESIGN; ANALYZE; DIRECT" });

export const metadata: Metadata = {
  ...homeMetadata,
  openGraph: { ...homeMetadata.openGraph, title: "emil lavinen ©" },
  twitter: { ...homeMetadata.twitter, title: "emil lavinen ©" },
};

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE_NAME,
  jobTitle: "Designer & Creative Director",
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

// The work list is the page's only content, so it doubles as the page's
// structured data — one CreativeWork per row, in the order they render.
const workSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: WORK.map((project, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "CreativeWork",
      name: project.title,
      dateCreated: project.year,
      creator: { "@type": "Person", name: SITE_NAME },
      ...(project.body ? { description: project.body[0] } : {}),
    },
  })),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(workSchema) }}
      />

      <h1 className="sr-only">Emil Lavinen — selected work</h1>

      <WorkList />
    </>
  );
}
