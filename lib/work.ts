/**
 * Homepage work list. Each entry renders one collapsible row on `/`
 * (see components/home/WorkList.tsx): the title and year are always
 * visible, everything else appears when the row is opened.
 *
 * A project with no `media` and no `body` falls back to `placeholder`,
 * which is how in-progress work is shown without a case study.
 */

/** A still. `src` is the grid thumbnail, `full` the version the viewer opens. */
export interface WorkImage {
  kind: "image";
  src: string;
  /** 1600px version, fetched only when the viewer opens on this item. */
  full: string;
  alt: string;
}

/**
 * A motion piece. `src` is a small silent cut that loops in the grid
 * while the row is open; `full` is the original, with sound, which only
 * starts downloading once the viewer opens on it.
 */
export interface WorkVideo {
  kind: "video";
  src: string;
  /** Frame shown before the loop has loaded, and in the viewer's poster slot. */
  poster: string;
  full: string;
  alt: string;
}

export type WorkMedia = WorkImage | WorkVideo;

export interface WorkProject {
  id: string;
  title: string;
  year: string;
  media?: WorkMedia[];
  body?: string[];
  placeholder?: string;
}

export const WORK: WorkProject[] = [
  {
    id: "balaclava-dawgs",
    title: "Balaclava Dawgs",
    year: "2023",
    media: [
      {
        kind: "image",
        src: "/work/balaclava-print.jpg",
        full: "/work/balaclava-print-full.jpg",
        alt: "Balaclava Dawgs print poster — black knitted mask on a light ground, with a QR code to the Instagram post",
      },
      {
        kind: "video",
        src: "/work/balaclava-digital-preview.mp4",
        poster: "/work/balaclava-digital.jpg",
        full: "/work/balaclava-digital-full.mp4",
        alt: "Balaclava Dawgs digital poster, animated — the white knitted mask on black glitching and tearing, with entrance pricing",
      },
    ],
    body: [
      "The organizers were moving the event away from trend-led lineups toward straight techno, and the poster had to read as that shift. The balaclava is both the event's name and what the crowd actually wears, so the whole sheet is built on one mask. Three formats, digital poster, printable poster with QR code and animated version for social media advertisement.",
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
