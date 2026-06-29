import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Emil Lavinen — Creative Director",
    template: "%s — Emil Lavinen",
  },
  description:
    "Emil Lavinen is a Creative Director based in Helsinki, working at the intersection of design, brand, and culture.",
  metadataBase: new URL("https://emillavinen.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://emillavinen.com",
    siteName: "Emil Lavinen",
    title: "Emil Lavinen — Creative Director",
    description:
      "Emil Lavinen is a Creative Director based in Helsinki, working at the intersection of design, brand, and culture.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Emil Lavinen — Creative Director",
    description:
      "Emil Lavinen is a Creative Director based in Helsinki, working at the intersection of design, brand, and culture.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
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
