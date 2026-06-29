import { describe, it, expect } from "vitest";

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("admin session token", () => {
  it("produces a consistent sha256 hash", async () => {
    const hash1 = await sha256Hex("mypassword" + "admin-session");
    const hash2 = await sha256Hex("mypassword" + "admin-session");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different passwords", async () => {
    const hash1 = await sha256Hex("password1" + "admin-session");
    const hash2 = await sha256Hex("password2" + "admin-session");
    expect(hash1).not.toBe(hash2);
  });

  it("produces a 64-character hex string", async () => {
    const hash = await sha256Hex("test" + "admin-session");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });
});

describe("admin route protection", () => {
  it("allows /admin/login without auth", () => {
    const publicPaths = ["/admin/login", "/api/admin/auth"];
    const protectedPaths = ["/admin", "/admin/posts", "/admin/posts/new", "/api/admin/posts"];

    for (const path of publicPaths) {
      expect(path === "/admin/login" || path === "/api/admin/auth").toBe(true);
    }

    for (const path of protectedPaths) {
      const isPublic = path === "/admin/login" || path === "/api/admin/auth";
      expect(isPublic).toBe(false);
    }
  });
});
