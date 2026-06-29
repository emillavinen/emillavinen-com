import { describe, it, expect } from "vitest";
import { readingTime, formatReadingTime } from "../lib/reading-time";

describe("readingTime", () => {
  it("returns 1 for empty content", () => {
    expect(readingTime("")).toBe(1);
  });

  it("calculates correctly for 200 words (1 min)", () => {
    const words = Array(200).fill("word").join(" ");
    expect(readingTime(words)).toBe(1);
  });

  it("rounds up for 201 words (2 min)", () => {
    const words = Array(201).fill("word").join(" ");
    expect(readingTime(words)).toBe(2);
  });

  it("handles 1000 words (5 min)", () => {
    const words = Array(1000).fill("word").join(" ");
    expect(readingTime(words)).toBe(5);
  });
});

describe("formatReadingTime", () => {
  it("formats single minute", () => {
    expect(formatReadingTime(1)).toBe("1 min read");
  });

  it("formats multiple minutes", () => {
    expect(formatReadingTime(7)).toBe("7 min read");
  });
});
