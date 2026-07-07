interface BackgroundTextProps {
  src: string;
}

/**
 * Standard way to place a "background text" SVG behind a page's content —
 * fixed to the viewport, edge-to-edge, stretched to fill (aspect ratio not
 * preserved), resizing with the window. Pass a different `src` per page;
 * each page renders at most one.
 *
 * IMPORTANT: the source SVG itself must have `preserveAspectRatio="none"`
 * on its root <svg> element. Without it, the SVG's default
 * "xMidYMid meet" behavior letterboxes its own content to whatever box
 * it's rendered into — background-size (or object-fit) only controls that
 * outer box, not how the SVG maps its viewBox inside it. Every new
 * background-text asset needs this attribute added, or it'll appear
 * centered with blank margins instead of stretched.
 *
 * Rendered as a CSS background-image rather than <img> + object-fit purely
 * to avoid next/image, whose image optimizer rejects SVG sources in
 * production unless `images.dangerouslyAllowSVG` is set (which would 400
 * this every time).
 *
 * ALSO ADD the same `src` to BACKGROUND_TEXT_BY_PATH in lib/constants.ts —
 * Nav reads that map to paint a matching slice of this artwork behind
 * itself (see components/layout/Nav.tsx) instead of a plain fill, so the
 * background continues seamlessly underneath the fixed header.
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
