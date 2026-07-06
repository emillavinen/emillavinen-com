interface BackgroundTextProps {
  src: string;
}

/**
 * Standard way to place a "background text" SVG behind a page's content —
 * fixed to the viewport, edge-to-edge, stretched to fill (aspect ratio not
 * preserved), resizing with the window. Pass a different `src` per page;
 * each page renders at most one.
 *
 * Uses a plain <img> rather than next/image: Next's image optimizer
 * rejects SVG sources in production unless `images.dangerouslyAllowSVG` is
 * set, which would 400 this every time.
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "fill",
        }}
      />
    </div>
  );
}
