import Link from "next/link";

/**
 * Homepage masthead: the red "emillavinen" wordmark. Static, not fixed —
 * it scrolls away with the rest of the page (see
 * components/layout/Nav.tsx for the fixed header the other public routes
 * use instead).
 *
 * Width and side padding deliberately match the `.work` list in
 * components/home/WorkList.tsx, so the wordmark runs edge to edge with
 * the rows below it and never overhangs them. Change one, change both.
 *
 * Rendered as <img> rather than inlined SVG on purpose: the source file
 * carries an internal <style> block scoping `.cls-1`, and inlining it
 * would leak that class name into the document.
 */
export default function Wordmark() {
  return (
    <header
      style={{
        width: "100%",
        maxWidth: "620px",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5) 0",
      }}
    >
      <Link href="/" aria-label="emillavinen — home" style={{ display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/emillavinen-wordmark.svg"
          alt="emillavinen"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </Link>
    </header>
  );
}
