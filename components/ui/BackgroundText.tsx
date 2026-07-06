interface BackgroundTextProps {
  src: string;
}

/**
 * Standard way to place a "background text" SVG behind a page's content —
 * fixed to the viewport, edge-to-edge, stretched to fill (aspect ratio not
 * preserved), resizing with the window. Pass a different `src` per page;
 * each page renders at most one.
 *
 * Rendered as a CSS background-image (not <img> + object-fit) because
 * WebKit/Safari has long-standing bugs where an <img> whose SVG source has
 * no explicit width/height falls back to an intrinsic size derived from the
 * viewBox, causing object-fit to be ignored inside fixed/absolute
 * containers. background-size resolves purely against this element's own
 * box and is unaffected by that replaced-element sizing algorithm, so it
 * reliably stretches on every browser, including Safari.
 *
 * Also avoids next/image: Next's image optimizer rejects SVG sources in
 * production unless `images.dangerouslyAllowSVG` is set, which would 400
 * this every time.
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
        backgroundImage: `url(${src})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    />
  );
}
