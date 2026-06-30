import Link from "next/link";
import { getFeaturedTestimonials, type Testimonial } from "@/content/testimonials";

function TestimonialItem({ t }: { t: Testimonial }) {
  return (
    <div style={{ marginBottom: "var(--space-16)" }}>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.25rem, 2.5vw, var(--text-2xl))",
          fontWeight: 400,
          lineHeight: "var(--leading-snug)",
          color: "var(--color-fg)",
          margin: "0 0 var(--space-6)",
          letterSpacing: "var(--tracking-tight)",
        }}
      >
        {t.text}
      </p>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          color: "var(--color-fg-muted)",
          margin: 0,
        }}
      >
        {t.name}
        {t.role ? `, ${t.role}` : ""}
        {t.company ? (
          <>
            {", "}
            {t.companyUrl ? (
              <Link
                href={t.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                {t.company}
              </Link>
            ) : (
              t.company
            )}
          </>
        ) : null}
      </p>
    </div>
  );
}

export default function Testimonials() {
  const featured = getFeaturedTestimonials();
  if (featured.length === 0) return null;

  return (
    <section style={{ marginTop: "var(--space-32)" }}>
      {featured.map((t) => (
        <TestimonialItem key={t.id} t={t} />
      ))}
    </section>
  );
}
