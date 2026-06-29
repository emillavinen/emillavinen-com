import type { Metadata } from "next";
import Container from "@/components/Container";

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
  {
    title: "Brand Identity",
    client: "TBD",
    year: "2025",
    category: "Identity",
  },
  {
    title: "Campaign Direction",
    client: "TBD",
    year: "2024",
    category: "Art Direction",
  },
  {
    title: "Editorial Design",
    client: "TBD",
    year: "2024",
    category: "Print",
  },
];

export default function ProjectsPage() {
  return (
    <Container>
      <h1 className="text-3xl font-light tracking-tight mb-12">
        Selected Projects
      </h1>
      <ul className="divide-y divide-neutral-200">
        {projects.map((project, i) => (
          <li key={i} className="py-6 flex items-baseline justify-between gap-8">
            <div>
              <p className="text-sm text-neutral-400 mb-1">{project.client}</p>
              <p className="text-lg font-light">{project.title}</p>
            </div>
            <div className="flex gap-8 shrink-0 text-xs tracking-widest uppercase text-neutral-400">
              <span>{project.category}</span>
              <span>{project.year}</span>
            </div>
          </li>
        ))}
      </ul>
    </Container>
  );
}
