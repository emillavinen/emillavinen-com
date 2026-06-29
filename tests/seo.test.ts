import { describe, it, expect } from "vitest";
import { buildMetadata } from "../lib/seo";
import { SITE_NAME, SITE_URL } from "../lib/constants";

describe("buildMetadata", () => {
  it("generates homepage title when no title given", () => {
    const meta = buildMetadata();
    expect(meta.title).toContain(SITE_NAME);
    expect(meta.title).toContain("Creative Director");
  });

  it("formats page title correctly", () => {
    const meta = buildMetadata({ title: "Writing" });
    expect(meta.title).toBe(`Writing — ${SITE_NAME}`);
  });

  it("sets canonical URL", () => {
    const meta = buildMetadata({ path: "/blog" });
    expect((meta.alternates as { canonical: string }).canonical).toBe(`${SITE_URL}/blog`);
  });

  it("sets openGraph type to article for posts", () => {
    const meta = buildMetadata({ type: "article", publishedTime: "2025-01-01" });
    expect((meta.openGraph as { type: string }).type).toBe("article");
  });

  it("sets twitter card", () => {
    const meta = buildMetadata();
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("uses provided description", () => {
    const desc = "A custom description";
    const meta = buildMetadata({ description: desc });
    expect(meta.description).toBe(desc);
  });
});
