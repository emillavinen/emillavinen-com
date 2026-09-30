import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { getGalleryWorks } from "@/lib/dispatch/site";
import WorkGrid from "@/components/work/WorkGrid";

// Static, and regenerated whenever DISPATCH writes a work (revalidatePath).
// The hourly revalidate is only a backstop for writes made outside the site,
// such as the local backlog import.
export const dynamic = "force-static";
export const revalidate = 3600;

const baseMetadata = buildMetadata({
  title: "Work",
  description: "All work by Emil Lavinen — design and creative direction, Helsinki.",
  path: "/work",
});

export const metadata: Metadata = {
  ...baseMetadata,
  alternates: {
    ...baseMetadata.alternates,
    types: { "application/rss+xml": `${SITE_URL}/work/rss.xml` },
  },
};

export default async function WorkPage() {
  const works = await getGalleryWorks();

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Work — ${SITE_NAME}`,
    url: `${SITE_URL}/work`,
    hasPart: works.slice(0, 100).map((w) => ({
      "@type": "CreativeWork",
      name: w.title,
      url: `${SITE_URL}/work/${w.slug}`,
      image: w.images[0]?.socialUrl,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <h1 className="sr-only">Emil Lavinen — work</h1>
      <WorkGrid works={works} />
    </>
  );
}
