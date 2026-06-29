import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects — Creative Direction & Brand Strategy Work",
  description:
    "Selected creative direction and brand strategy projects by Emil Lavinen — brand identities, campaigns, and visual systems for organisations across Finland and Europe.",
  alternates: {
    canonical: "https://emillavinen.com/projects",
  },
  openGraph: {
    title: "Projects — Emil Lavinen, Creative Director",
    description:
      "Selected creative direction and brand strategy projects by Emil Lavinen — brand identities, campaigns, and visual systems for organisations across Finland and Europe.",
    url: "https://emillavinen.com/projects",
  },
};

const projects = [
  { title: "Brand Identity",    client: "TBD", year: "2025", category: "Identity" },
  { title: "Campaign Direction", client: "TBD", year: "2024", category: "Art Direction" },
  { title: "Editorial Design",  client: "TBD", year: "2024", category: "Print" },
];

export default function ProjectsPage() {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "var(--space-32) var(--space-8)",
        paddingBottom: "calc(var(--space-32) + 80px)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: "800px" }}>
        {projects.map((project, i) => (
          <li
            key={i}
            style={{
              padding: "var(--space-6) 0",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--space-8)",
              marginBottom: "var(--space-4)",
            }}
          >
            <div>
              <p style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", color: "var(--color-fg-muted)", margin: "0 0 var(--space-1)", textTransform: "uppercase" }}>{project.client}</p>
              <p style={{ fontSize: "var(--text-xl)", fontWeight: 400, color: "var(--color-fg)", margin: 0 }}>{project.title}</p>
            </div>
            <div style={{ display: "flex", gap: "var(--space-8)", flexShrink: 0, fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-widest)", textTransform: "uppercase", color: "var(--color-fg-muted)" }}>
              <span>{project.category}</span>
              <span>{project.year}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
