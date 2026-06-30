import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Emil Lavinen";
  const tagsRaw = searchParams.get("tags") ?? "";
  const tags = tagsRaw ? tagsRaw.split(",").filter(Boolean).slice(0, 5) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0A0A0A",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top: author name */}
        <div
          style={{
            color: "#FFFFFF",
            fontSize: "16px",
            fontWeight: 400,
            letterSpacing: "6px",
            textTransform: "uppercase",
          }}
        >
          EMIL LAVINEN
        </div>

        {/* Center: post title */}
        <div
          style={{
            color: "#FFFFFF",
            fontSize: title.length > 50 ? "52px" : "64px",
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: "-1px",
            maxWidth: "960px",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title}
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* Tags */}
          <div
            style={{
              color: "#888888",
              fontSize: "14px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              display: "flex",
              gap: "16px",
            }}
          >
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          {/* Site URL */}
          <div
            style={{
              color: "#555555",
              fontSize: "14px",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            EMILLAVINEN.COM
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
