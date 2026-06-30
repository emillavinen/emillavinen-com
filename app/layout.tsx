import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Emil Lavinen — Creative Director & Brand Strategist, Helsinki",
    template: "%s — Emil Lavinen",
  },
  description:
    "Emil Lavinen is a Creative Director and Brand Strategist based in Helsinki, working at the intersection of design, brand, and culture.",
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
    title: "Emil Lavinen — Creative Director & Brand Strategist, Helsinki",
    description:
      "Emil Lavinen is a Creative Director and Brand Strategist based in Helsinki, working at the intersection of design, brand, and culture.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Emil Lavinen — Creative Director & Brand Strategist, Helsinki",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Emil Lavinen — Creative Director & Brand Strategist, Helsinki",
    description:
      "Emil Lavinen is a Creative Director and Brand Strategist based in Helsinki, working at the intersection of design, brand, and culture.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full`}>
      <head>
        <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="alternate" type="application/rss+xml" title="Emil Lavinen" href="/feed.xml" />
        <meta name="theme-color" content="#0A0A0A" />
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
