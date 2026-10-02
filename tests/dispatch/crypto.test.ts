// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { canEncrypt, decryptJson, encryptJson, signValue, verifySignedValue } from "@/lib/dispatch/crypto";
import { parseDropInput, isOwnUpload, splitList } from "@/lib/dispatch/drop";
import { oauth1Header } from "@/lib/dispatch/platforms/oauth1";
import { cleanEnv } from "./helpers";

let restore: () => void = () => {};
afterEach(() => restore());

describe("credential encryption", () => {
  it("round-trips, and fails with another key", () => {
    restore = cleanEnv({ DISPATCH_ENCRYPTION_KEY: "key-one" });
    const sealed = encryptJson({ accessToken: "abc", n: 1 });
    expect(sealed).not.toContain("abc");
    expect(decryptJson(sealed)).toEqual({ accessToken: "abc", n: 1 });
    process.env.DISPATCH_ENCRYPTION_KEY = "key-two";
    expect(() => decryptJson(sealed)).toThrow();
  });

  it("is off without a key", () => {
    restore = cleanEnv();
    expect(canEncrypt()).toBe(false);
    expect(() => encryptJson({})).toThrow(/DISPATCH_ENCRYPTION_KEY/);
  });
});

describe("signed values (OAuth state cookie)", () => {
  it("verifies, expires, and rejects tampering", () => {
    const token = signValue("s", { state: "x" }, 1000, 0);
    expect(verifySignedValue("s", token, 500)).toEqual({ state: "x" });
    expect(verifySignedValue("s", token, 1500)).toBeNull();
    expect(verifySignedValue("other", token, 500)).toBeNull();
    expect(verifySignedValue("s", token.replace(/^./, "A"), 500)).toBeNull();
    expect(verifySignedValue("s", undefined)).toBeNull();
  });
});

describe("OAuth 1.0a", () => {
  it("matches X's documented signature example", () => {
    // https://developer.x.com/en/docs/authentication/oauth-1-0a/creating-a-signature
    const header = oauth1Header(
      "POST",
      "https://api.twitter.com/1.1/statuses/update.json?include_entities=true",
      {
        consumerKey: "xvz1evFS4wEEPTGEFPHBog",
        consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
        token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      },
      { status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
      { nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", timestamp: 1318622958 }
    );
    expect(header).toContain(`oauth_signature="${encodeURIComponent("hCtSmYh+iHYCEqBWrE7C7hYmtUk=")}"`);
    expect(header.startsWith("OAuth ")).toBe(true);
  });
});

describe("drop input", () => {
  const upload = { url: "https://abc.public.blob.vercel-storage.com/uploads/a-x1.jpg", name: "a.jpg" };

  it("accepts 1–4 uploads from this store only", () => {
    expect(isOwnUpload(upload.url)).toBe(true);
    expect(isOwnUpload("https://evil.example.com/uploads/a.jpg")).toBe(false);
    expect(isOwnUpload("https://abc.public.blob.vercel-storage.com/works/a.jpg")).toBe(false);
    expect(parseDropInput({ uploads: [] })).toEqual({ error: "Add at least one image." });
    expect(parseDropInput({ uploads: Array(5).fill(upload) })).toEqual({ error: "At most 4 images." });
  });

  it("cleans the fields", () => {
    const parsed = parseDropInput({
      uploads: [upload],
      title: "  Poster ",
      tools: "Figma, , Photoshop",
      tags: "#poster, techno",
      year: "2024",
      client: "",
      platforms: ["x", "arena", "instagram"],
    });
    expect(parsed).toMatchObject({ title: "Poster", tools: ["Figma", "Photoshop"], tags: ["poster", "techno"], year: 2024, client: null, platforms: ["x", "arena"] });
    expect(parseDropInput({ uploads: [upload], year: "20x4" })).toEqual({ error: "Year looks wrong." });
    expect(splitList(["a, b", "c"])).toEqual(["a", "b", "c"]);
  });
});
