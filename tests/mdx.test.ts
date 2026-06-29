import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { getPostBySlug, getAllPosts } from "../lib/mdx";

const BLOG_DIR = path.join(process.cwd(), "content/blog");
const TEST_SLUG = "__vitest-test-post__";
const TEST_FILE = path.join(BLOG_DIR, `${TEST_SLUG}.mdx`);

const CONTENT_200_WORDS = Array(200).fill("word").join(" ");

const TEST_MDX = [
  "---",
  "title: Test Post",
  "date: 2025-01-15",
  "description: A test description.",
  "published: true",
  "tags:",
  "  - design",
  "  - brand",
  "---",
  "",
  CONTENT_200_WORDS,
].join("\n");

beforeAll(() => {
  fs.writeFileSync(TEST_FILE, TEST_MDX, "utf8");
});

afterAll(() => {
  if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
});

describe("getPostBySlug", () => {
  it("parses title, date, description, published", () => {
    const post = getPostBySlug(TEST_SLUG);
    expect(post.title).toBe("Test Post");
    expect(post.date).toBe("2025-01-15");
    expect(post.description).toBe("A test description.");
    expect(post.published).toBe(true);
  });

  it("parses tags array from YAML", () => {
    const post = getPostBySlug(TEST_SLUG);
    expect(post.tags).toEqual(["design", "brand"]);
  });

  it("calculates reading time: 200 words = 1 min", () => {
    const post = getPostBySlug(TEST_SLUG);
    expect(post.readingTime).toBe(1);
  });
});

describe("getAllPosts", () => {
  it("includes the test post", () => {
    const posts = getAllPosts();
    expect(posts.some((p) => p.slug === TEST_SLUG)).toBe(true);
  });

  it("only returns published posts", () => {
    const posts = getAllPosts();
    expect(posts.every((p) => p.published)).toBe(true);
  });

  it("sorts newest first", () => {
    const posts = getAllPosts();
    for (let i = 1; i < posts.length; i++) {
      expect(posts[i - 1].date >= posts[i].date).toBe(true);
    }
  });
});
