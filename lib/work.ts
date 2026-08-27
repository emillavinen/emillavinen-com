/**
 * Homepage work list. Each entry renders one collapsible row on `/`
 * (see components/home/WorkList.tsx): the title and year are always
 * visible, everything else appears when the row is opened.
 *
 * A project with no `images` and no `body` falls back to `placeholder`,
 * which is how in-progress work is shown without a case study.
 */
export interface WorkImage {
  /** Grid thumbnail — 800px wide. */
  src: string;
  /** 1600px version, fetched only when the lightbox opens on this image. */
  full: string;
  alt: string;
}

export interface WorkProject {
  id: string;
  title: string;
  year: string;
  images?: WorkImage[];
  body?: string[];
  placeholder?: string;
}

export const WORK: WorkProject[] = [
  {
    id: "balaclava-wags",
    title: "Balaclava Wags",
    year: "2023",
    images: [
      {
        src: "/work/balaclava-print.jpg",
        full: "/work/balaclava-print-full.jpg",
        alt: "Balaclava Wags print poster — black knitted mask on a light ground, with a QR code to the Instagram post",
      },
      {
        src: "/work/balaclava-digital.jpg",
        full: "/work/balaclava-digital-full.jpg",
        alt: "Balaclava Wags digital poster — white knitted mask on black, with entrance pricing",
      },
    ],
    body: [
      "The organizers were moving the event away from trend-led lineups toward straight techno, and the poster had to read as that shift. The balaclava is both the event's name and what the crowd actually wears, so the whole sheet is built on one mask, high-contrast black and white, emerging out of a cascade of the wordmark repeating and flipping down the page.",
    ],
  },
  {
    id: "fear-god-production",
    title: "Fear God Production",
    year: "2024",
    placeholder: "In the process...",
  },
  {
    id: "soznanie-fest",
    title: "Soznanie Fest",
    year: "2023",
    placeholder: "In the process...",
  },
];
