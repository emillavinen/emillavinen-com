import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import ContactBar from "@/components/layout/ContactBar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
      <ContactBar />
    </>
  );
}
