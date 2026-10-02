import { afterEach, describe, expect, it } from "vitest";
import { arena } from "@/lib/dispatch/platforms/arena";
import { bluesky } from "@/lib/dispatch/platforms/bluesky";
import { creditsLine, fitBlocks, graphemeLength, truncate, utmLink } from "@/lib/dispatch/platforms/format";
import { escapeLittleText, linkedin } from "@/lib/dispatch/platforms/linkedin";
import { threads, threadsLength } from "@/lib/dispatch/platforms/threads";
import { tumblr } from "@/lib/dispatch/platforms/tumblr";
import { x, xWeightedLength } from "@/lib/dispatch/platforms/x";
import { cleanEnv } from "./helpers";

let restore: () => void = () => {};
afterEach(() => restore());

const full = {
  title: "Balaclava Dawgs",
  caption: "Poster series for a techno night. Three formats: print, digital, motion.",
  client: "Balaclava",
  tools: ["Photoshop", "After Effects"],
  tags: ["poster", "techno"],
  year: 2023,
};
const bare = { title: "Untitled Study", caption: "", client: null, tools: [], tags: [], year: null };
const link = "https://emillavinen.com/work/balaclava-dawgs?utm_source=x&utm_medium=social&utm_campaign=dispatch";
const ALL = [arena, x, threads, linkedin, bluesky, tumblr];

describe("links", () => {
  it("point at the work page with UTM parameters", () => {
    restore = cleanEnv();
    expect(utmLink("balaclava-dawgs", "threads")).toBe(
      "https://emillavinen.com/work/balaclava-dawgs?utm_source=threads&utm_medium=social&utm_campaign=dispatch"
    );
  });
});

describe("formatters", () => {
  it("never print undefined/null, blank lines or stray separators for empty fields", () => {
    restore = cleanEnv();
    for (const adapter of ALL) {
      const text = adapter.format(bare, link);
      expect(text).not.toMatch(/undefined|null|NaN/);
      expect(text).not.toMatch(/\n{3,}/);
      expect(text).not.toMatch(/(^|\n)\s*[·,|-]\s*($|\n)/);
      expect(text).toBe(text.trim());
    }
  });

  it("X: title plus caption when it fits, no link by default", () => {
    restore = cleanEnv();
    expect(x.format(full, link)).toBe(`${full.title}\n\n${full.caption}`);
    expect(x.format(full, link)).not.toContain("http");
  });

  it("X: drops the caption rather than cut it, and adds the link when X_INCLUDE_LINK=true", () => {
    restore = cleanEnv({ X_INCLUDE_LINK: "true" });
    const long = { ...full, caption: "word ".repeat(80).trim() };
    const text = x.format(long, link);
    expect(text).toBe(`${full.title}\n\n${link}`);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(280);
  });

  it("X: a title longer than a post is shortened with an ellipsis", () => {
    restore = cleanEnv();
    const text = x.format({ ...bare, title: "Very long title ".repeat(30) }, link);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(280);
    expect(text.endsWith("…")).toBe(true);
  });

  it("Threads: title, caption, link within 500 (emoji counted by bytes)", () => {
    restore = cleanEnv();
    expect(threads.format(full, link)).toBe(`${full.title}\n\n${full.caption}\n\n${link}`);
    const long = threads.format({ ...full, caption: "🔥 lorem ipsum ".repeat(80) }, link);
    expect(threadsLength(long)).toBeLessThanOrEqual(500);
    expect(long.endsWith(link)).toBe(true);
    expect(threadsLength("🔥")).toBe(4);
  });

  it("LinkedIn: title, one line of client and tools, the link", () => {
    restore = cleanEnv();
    expect(linkedin.format(full, link)).toBe(`Balaclava Dawgs\n\nBalaclava · Photoshop, After Effects\n\n${link}`);
    expect(linkedin.format({ ...full, client: null }, link)).toBe(`Balaclava Dawgs\n\nPhotoshop, After Effects\n\n${link}`);
    expect(linkedin.format(bare, link)).toBe(`Untitled Study\n\n${link}`);
  });

  it("LinkedIn: escapes little-text reserved characters, including the link's underscores", () => {
    expect(escapeLittleText("a_b (c) #d @e [f] <g> *h* ~i~ {j} |k| \\")).toBe(
      "a\\_b \\(c\\) \\#d \\@e \\[f\\] \\<g\\> \\*h\\* \\~i\\~ \\{j\\} \\|k\\| \\\\"
    );
    expect(escapeLittleText(link)).toContain("utm\\_source");
  });

  it("Bluesky: 300 graphemes, link kept whole at the end", () => {
    restore = cleanEnv();
    const text = bluesky.format({ ...full, caption: "é".repeat(400) }, link);
    expect(graphemeLength(text)).toBeLessThanOrEqual(300);
    expect(text.endsWith(link)).toBe(true);
  });

  it("Are.na description: caption and link; Tumblr caption is the caption only", () => {
    restore = cleanEnv();
    expect(arena.format(full, link)).toBe(`${full.caption}\n\n${link}`);
    expect(arena.format(bare, link)).toBe(link);
    expect(tumblr.format(full, link)).toBe(full.caption);
  });
});

describe("text helpers", () => {
  it("truncate cuts at a word boundary with an ellipsis", () => {
    expect(truncate("one two three four five", 12)).toBe("one two…");
    expect(truncate("short", 12)).toBe("short");
  });

  it("fitBlocks gives up the body first, then shortens the head", () => {
    expect(fitBlocks({ head: "Title", body: "b".repeat(50), tail: "L" }, 20)).toBe("Title\n\nL");
    expect(graphemeLength(fitBlocks({ head: "T".repeat(50), tail: "LINK" }, 20))).toBeLessThanOrEqual(20);
  });

  it("creditsLine joins only what exists", () => {
    expect(creditsLine({ client: " ", tools: ["", " Figma "] })).toBe("Figma");
    expect(creditsLine({ client: null, tools: [] })).toBe("");
  });
});
