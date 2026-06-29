import { describe, it, expect } from "vitest";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify("  Hello  ")).toBe("hello");
  });

  it("collapses multiple separators", () => {
    expect(slugify("Hello -- World!")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("Brand & Identity: A Deep Dive")).toBe("brand-identity-a-deep-dive");
  });

  it("handles already-valid slugs unchanged", () => {
    expect(slugify("on-visual-identity")).toBe("on-visual-identity");
  });
});
