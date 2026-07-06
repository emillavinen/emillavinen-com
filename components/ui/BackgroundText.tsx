interface BackgroundTextProps {
  src: string;
}

// Must match Nav's fixed header height (components/layout/Nav.tsx).
const NAV_HEIGHT = "56px";

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
 * Nav (z-index 100) paints an opaque background over its own 56px strip so
 * scrolled-under page content doesn't bleed through it. The second element
 * below repaints that exact strip with the same artwork, sized against the
 * viewport (100vw/100vh, positioned at the origin) rather than its own box —
 * this makes it show precisely the top slice of the same full-viewport
 * image, seamlessly continuing the background behind Nav, while staying
 * fully opaque to whatever scrolls underneath.
 */
export default function BackgroundText({ src }: BackgroundTextProps) {
  return (
    <>
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
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: NAV_HEIGHT,
          zIndex: 101,
          pointerEvents: "none",
          backgroundColor: "var(--color-bg)",
          backgroundImage: `url(${src})`,
          backgroundSize: "100vw 100vh",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
        }}
      />
    </>
  );
}
