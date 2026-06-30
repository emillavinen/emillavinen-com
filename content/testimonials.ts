export type Testimonial = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  companyUrl: string | null;
  text: string;
  date: string;
  featured: boolean;
  project: string | null;
};

export const testimonials: Testimonial[] = [
  // REPLACE WITH REAL TESTIMONIAL
  {
    id: "placeholder-a",
    name: "Person A",
    role: "Chief Marketing Officer",
    company: "Company Name",
    companyUrl: null,
    text: "Working with Emil transformed how we think about our brand. The strategic clarity he brought to our identity work gave us something we could actually build on — not just a visual system, but a point of view.",
    date: "2024-01-01",
    featured: true,
    project: null,
  },
  // REPLACE WITH REAL TESTIMONIAL
  {
    id: "placeholder-b",
    name: "Person B",
    role: "Founder",
    company: "Company Name",
    companyUrl: null,
    text: "Emil doesn't just design — he thinks. Every decision came with a reason, and that made the whole process feel like genuine collaboration rather than a service transaction.",
    date: "2024-06-01",
    featured: true,
    project: null,
  },
  // REPLACE WITH REAL TESTIMONIAL
  {
    id: "placeholder-c",
    name: "Person C",
    role: "Creative Director",
    company: "Company Name",
    companyUrl: null,
    text: "The brand strategy Emil developed for us cut through six months of internal debate in three weeks. He has a rare ability to find the essential thing and make it legible to everyone in the room.",
    date: "2025-03-01",
    featured: true,
    project: null,
  },
];

export function getFeaturedTestimonials(): Testimonial[] {
  return testimonials.filter((t) => t.featured);
}

export function getAllTestimonials(): Testimonial[] {
  return [...testimonials].sort((a, b) => b.date.localeCompare(a.date));
}
