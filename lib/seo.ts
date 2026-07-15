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
    : `${SITE_NAME} — Designer & Creative Director, Helsinki`;

  const url = `${SITE_URL}${path}`;

  return {
    // pageTitle already includes the site name, so mark it absolute —
    // otherwise the root layout's title.template re-appends "— Emil Lavinen".
    title: { absolute: pageTitle },
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
