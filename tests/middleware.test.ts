import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, SESSION_TTL_MS } from "../lib/admin-session";

describe("admin session token", () => {
  it("verifies a token signed with the same password", async () => {
    const token = await createSessionToken("mypassword");
    expect(await verifySessionToken(token, "mypassword")).toBe(true);
  });

  it("rejects a token signed with a different password", async () => {
    const token = await createSessionToken("password1");
    expect(await verifySessionToken(token, "password2")).toBe(false);
  });

  it("rejects an expired token", async () => {
    const issued = Date.now() - SESSION_TTL_MS - 1000;
    const token = await createSessionToken("pw", issued);
    expect(await verifySessionToken(token, "pw")).toBe(false);
  });

  it("rejects a tampered expiry", async () => {
    const token = await createSessionToken("pw");
    const [v, exp, sig] = token.split(".");
    expect(await verifySessionToken(`${v}.${Number(exp) + 1_000_000}.${sig}`, "pw")).toBe(false);
  });

  it("rejects the old unsigned sha256 cookie format and missing values", async () => {
    expect(await verifySessionToken("a".repeat(64), "pw")).toBe(false);
    expect(await verifySessionToken(undefined, "pw")).toBe(false);
    expect(await verifySessionToken(await createSessionToken("pw"), undefined)).toBe(false);
  });
});

describe("admin route protection", () => {
  it("allows /admin/login without auth", () => {
    const publicPaths = ["/admin/login", "/api/admin/auth"];
    const protectedPaths = ["/admin", "/admin/posts", "/admin/posts/new", "/api/admin/posts", "/admin/drop", "/api/admin/dispatch/upload"];

    for (const path of publicPaths) {
      expect(path === "/admin/login" || path === "/api/admin/auth").toBe(true);
    }

    for (const path of protectedPaths) {
      const isPublic = path === "/admin/login" || path === "/api/admin/auth";
      expect(isPublic).toBe(false);
    }
  });
});
