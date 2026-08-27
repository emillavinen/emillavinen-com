"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import ContactBar from "@/components/layout/ContactBar";
import Wordmark from "@/components/home/Wordmark";
import HomeFooter from "@/components/home/HomeFooter";

/**
 * The homepage and the writing pages use different chrome. `/` is the
 * stripped-down work list: a static full-width wordmark on top and a
 * single row of links underneath. Everything else keeps the fixed 56px
 * nav bar (which is why `main` is offset by that height there, and not
 * on the homepage).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const isHome = usePathname() === "/";

  return (
    <>
      {isHome ? <Wordmark /> : <Nav />}

      <main style={{ flex: 1, paddingTop: isHome ? 0 : "56px" }}>{children}</main>

      {isHome ? (
        <HomeFooter />
      ) : (
        <>
          <Footer />
          <ContactBar />
        </>
      )}
    </>
  );
}
