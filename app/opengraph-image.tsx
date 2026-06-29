import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Emil Lavinen — Creative Director & Brand Strategist, Helsinki";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
          borderTop: "4px solid #111111",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <p
            style={{
              fontSize: "16px",
              color: "#999999",
              margin: 0,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Creative Director &amp; Brand Strategist
          </p>
          <h1
            style={{
              fontSize: "80px",
              fontWeight: "300",
              color: "#111111",
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Emil Lavinen
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <p style={{ fontSize: "16px", color: "#aaaaaa", margin: 0, letterSpacing: "0.05em" }}>
            Helsinki, Finland
          </p>
          <p style={{ fontSize: "16px", color: "#aaaaaa", margin: 0, letterSpacing: "0.05em" }}>
            emillavinen.com
          </p>
        </div>
      </div>
    ),
    { ...size }
  );
}
