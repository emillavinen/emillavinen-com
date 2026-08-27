import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import { SITE_DESCRIPTION } from "@/lib/constants";
import "./globals.css";

// Monospac821 BT — the site's only typeface, self-hosted from
// app/fonts (the CSP in middleware.ts allows font-src 'self' only).
// Both weights are wired up: 400 for body copy, 700 for the work-list
// rows and other headings.
const monospac821 = localFont({
  src: [
    { path: "./fonts/Monospac821BT-Roman.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Monospac821BT-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-monospac821",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "emillavinen.com",
    template: "%s — Emil Lavinen",
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL("https://emillavinen.com"),
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://emillavinen.com",
    siteName: "Emil Lavinen",
    title: "Emil Lavinen — Designer & Creative Director, Helsinki",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Emil Lavinen — Designer & Creative Director, Helsinki",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Emil Lavinen — Designer & Creative Director, Helsinki",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${monospac821.variable} h-full`}>
      <head>
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="alternate" type="application/rss+xml" title="Emil Lavinen" href="/feed.xml" />
        <meta name="theme-color" content="#FFFFFF" />
        <meta name="msapplication-TileColor" content="#0A0A0A" />
        <meta name="msapplication-TileImage" content="/icons/mstile-150x150.png" />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <Analytics />
        {/* Privacy-friendly analytics by Plausible */}
        <Script
          src="https://plausible.io/js/pa-Ir0VXW9zThgCRvXE2xnVn.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">{`
          window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
          plausible.init()
        `}</Script>
      </body>
    </html>
  );
}
