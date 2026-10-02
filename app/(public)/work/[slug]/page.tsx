import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { displayYear, getGalleryWork, socialSize } from "@/lib/dispatch/site";

// Rendered on first request, then cached until DISPATCH revalidates it.
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

function describe(work: { title: string; caption: string }): string {
  const text = work.caption.replace(/\s+/g, " ").trim();
  if (!text) return `${work.title} — work by ${SITE_NAME}, designer in Helsinki.`;
  return text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const work = await getGalleryWork(slug);
  if (!work) return { title: "Not found", robots: { index: false } };
  const base = buildMetadata({ title: work.title, description: describe(work), path: `/work/${work.slug}` });
  // The JPEG, not the WebP: some previews still refuse WebP.
  const cover = work.images[0];
  const size = socialSize(cover);
  const image = { url: cover.socialUrl, width: size.width, height: size.height, alt: cover.alt, type: "image/jpeg" };
  return {
    ...base,
    openGraph: { ...base.openGraph, images: [image] },
    twitter: { ...base.twitter, card: "summary_large_image", images: [cover.socialUrl] },
  };
}

export default async function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await getGalleryWork(slug);
  if (!work) notFound();

  const year = displayYear(work);
  const tools = work.tools.join(", ");
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: work.title,
    url: `${SITE_URL}/work/${work.slug}`,
    image: work.images.map((i) => i.socialUrl),
    dateCreated: year,
    creator: { "@type": "Person", name: SITE_NAME, url: SITE_URL },
    ...(work.caption ? { description: work.caption } : {}),
    ...(work.client ? { sourceOrganization: { "@type": "Organization", name: work.client } } : {}),
    ...(work.tags.length > 0 ? { keywords: work.tags.join(", ") } : {}),
  };

  return (
    <article className="piece">
      <style>{`
        .piece {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-12) var(--space-5) var(--space-24);
          font-family: var(--font-sans);
        }
        @media (min-width: 720px) {
          .piece { padding: var(--space-16) var(--space-8) var(--space-32); }
        }
        .piece__images { display: flex; flex-direction: column; align-items: center; gap: var(--space-6); margin-bottom: var(--space-12); }
        /* Each image is as wide as the column allows but never taller than
           most of the screen; its box is sized from the stored aspect ratio
           (inline style), so nothing moves while it loads. */
        .piece__images img {
          display: block;
          max-width: 100%;
          height: auto;
          background: var(--color-bg-secondary);
        }
        .piece__text { max-width: 620px; margin: 0 auto; }
        .piece__head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: var(--space-4);
          margin: 0 0 var(--space-5);
          font-size: var(--text-sm);
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-fg);
        }
        .piece__head h1 { font: inherit; margin: 0; }
        .piece__facts { margin: 0 0 var(--space-5); padding: 0; }
        .piece__fact {
          display: flex;
          gap: var(--space-4);
          font-size: var(--text-xs);
          letter-spacing: var(--tracking-wide);
          text-transform: uppercase;
          line-height: var(--leading-normal);
        }
        .piece__fact dt { color: var(--color-fg-muted); min-width: 5.5em; }
        .piece__fact dd { margin: 0; color: var(--color-fg-secondary); }
        .piece__caption p {
          margin: 0 0 var(--space-4);
          font-size: var(--text-sm);
          line-height: var(--leading-normal);
          text-align: justify;
          text-align-last: left;
          color: var(--color-fg-secondary);
          white-space: pre-line;
        }
        .piece__back {
          display: inline-block;
          margin-top: var(--space-8);
          font-size: var(--text-xs);
          letter-spacing: var(--tracking-widest);
          text-transform: uppercase;
          text-decoration: underline;
          color: var(--color-link-secondary);
          transition: color var(--transition-base);
        }
        .piece__back:hover { color: var(--color-fg); }
      `}</style>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div className="piece__images">
        {work.images.map((image, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={image.displayUrl}
            src={image.displayUrl}
            srcSet={`${image.thumbUrl} 800w, ${image.displayUrl} ${image.width}w`}
            sizes="(min-width: 1264px) 1200px, calc(100vw - 40px)"
            alt={image.alt}
            width={image.width}
            height={image.height}
            style={{ width: `min(100%, calc(85svh * ${(image.width / image.height).toFixed(4)}))`, aspectRatio: `${image.width} / ${image.height}` }}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            decoding="async"
          />
        ))}
      </div>

      <div className="piece__text">
        <header className="piece__head">
          <h1>{work.title}</h1>
          <span>{year}</span>
        </header>

        {(work.client || tools) && (
          <dl className="piece__facts">
            {work.client && (
              <div className="piece__fact">
                <dt>Client</dt>
                <dd>{work.client}</dd>
              </div>
            )}
            {tools && (
              <div className="piece__fact">
                <dt>Tools</dt>
                <dd>{tools}</dd>
              </div>
            )}
          </dl>
        )}

        {work.caption && (
          <div className="piece__caption">
            <p>{work.caption}</p>
          </div>
        )}

        <Link href="/work" className="piece__back">
          all work
        </Link>
      </div>
    </article>
  );
}
