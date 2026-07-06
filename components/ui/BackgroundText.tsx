import Image from "next/image";

interface BackgroundTextProps {
  src: string;
}

/**
 * Standard way to place a "background text" SVG behind a page's content —
 * fixed to the viewport, edge-to-edge, stretched to fill (aspect ratio not
 * preserved). Pass a different `src` per page; each page renders at most one.
 */
export default function BackgroundText({ src }: BackgroundTextProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        priority
        style={{ objectFit: "fill" }}
      />
    </div>
  );
}
