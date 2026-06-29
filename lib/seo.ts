import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "./constants";

interface PageSeoOptions {
  title?: string;
  description?: string;
  path?: string;
  type?: "website" | "article";
  publishedTime?: string;
}

export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "",
  type = "website",
  publishedTime,
}: PageSeoOptions = {}): Metadata {
  const pageTitle = title
    ? `${title} — ${SITE_NAME}`
    : `${SITE_NAME} — Creative Director & Brand Strategist, Helsinki`;

  const url = `${SITE_URL}${path}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: pageTitle,
      description,
      url,
      siteName: SITE_NAME,
      type,
      ...(publishedTime ? { publishedTime, authors: [SITE_NAME] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
    },
  };
}
