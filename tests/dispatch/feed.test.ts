import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { boardFeedUrl, decodeEntities, FeedFormatError, imageCandidates, normalizeBoardUrl, parseFeed } from "@/lib/dispatch/pinterest/feed";

// A real board feed (pinterest.com/emillavinen/feargod-2010.rss, fetched 2026-09-30).
const fixture = readFileSync(path.join(__dirname, "fixtures/pinterest-board.rss"), "utf8");

describe("Pinterest board RSS", () => {
  it("parses every pin: id from the link, image from the description", () => {
    const feed = parseFeed(fixture);
    expect(feed.title).toBe("FEAR♱GOD 2010");
    expect(feed.items.length).toBe(25);
    const first = feed.items[0];
    expect(first.pinId).toBe("693906255131793877");
    expect(first.link).toBe("https://www.pinterest.com/pin/693906255131793877/");
    expect(first.imageUrl).toBe("https://i.pinimg.com/236x/3a/15/e8/3a15e83c7eb2922374d6bb168ef5f494.jpg");
    expect(first.pubDate?.toISOString()).toBe("2026-06-11T09:20:05.000Z");
    expect(first.title).toBe("");
  });

  it("skips items without an image (idea pins with an alphanumeric id and an empty img)", () => {
    const feed = parseFeed(fixture);
    expect(fixture).toContain("/pin/tq8azUQE/");
    expect(feed.items.find((i) => i.pinId === "tq8azUQE")).toBeUndefined();
  });

  it("decodes the double-escaped description text", () => {
    const item = parseFeed(fixture).items.find((i) => i.pinId === "693906255131401629")!;
    expect(item.title).toBe("ᴄʀᴇᴅɪᴛs: @drinkinginistanbul");
    expect(item.description).not.toContain("&#");
    expect(item.description).not.toContain("<");
    expect(item.description.startsWith("ᴄʀᴇᴅɪᴛs:")).toBe(true);
  });

  it("treats a non-RSS response or a changed item shape as a changed feed", () => {
    expect(() => parseFeed("<html><body>Blocked</body></html>")).toThrow(FeedFormatError);
    expect(() => parseFeed("")).toThrow(FeedFormatError);
    const changed = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title><item><title>a</title><link>https://example.com/nope</link><description>no image</description></item></channel></rss>`;
    expect(() => parseFeed(changed)).toThrow(/format changed/);
    const empty = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>`;
    expect(parseFeed(empty).items).toEqual([]);
  });

  it("asks for originals, then 1200x, then 736x, then the given size", () => {
    expect(imageCandidates("https://i.pinimg.com/236x/3a/15/e8/abc.jpg")).toEqual([
      "https://i.pinimg.com/originals/3a/15/e8/abc.jpg",
      "https://i.pinimg.com/1200x/3a/15/e8/abc.jpg",
      "https://i.pinimg.com/736x/3a/15/e8/abc.jpg",
      "https://i.pinimg.com/236x/3a/15/e8/abc.jpg",
    ]);
    expect(imageCandidates("https://example.com/a.jpg")).toEqual(["https://example.com/a.jpg"]);
  });

  it("normalises whatever board URL Emil pastes", () => {
    for (const input of [
      "https://www.pinterest.com/emillavinen/feargod-2010/",
      "https://pinterest.com/emillavinen/feargod-2010",
      "pinterest.com/emillavinen/feargod-2010.rss",
      "https://fi.pinterest.com/emillavinen/feargod-2010/?invite=1",
    ]) {
      expect(normalizeBoardUrl(input)).toBe("https://www.pinterest.com/emillavinen/feargod-2010");
    }
    expect(normalizeBoardUrl("https://www.pinterest.com/emillavinen/")).toBeNull();
    expect(normalizeBoardUrl("https://example.com/a/b")).toBeNull();
    expect(boardFeedUrl("https://www.pinterest.com/emillavinen/feargod-2010")).toBe("https://www.pinterest.com/emillavinen/feargod-2010.rss");
  });

  it("decodes numeric and named entities", () => {
    expect(decodeEntities("&#71922;&#x41;&amp;&quot;&unknown;")).toBe(`${String.fromCodePoint(71922)}A&"&unknown;`);
  });
});
