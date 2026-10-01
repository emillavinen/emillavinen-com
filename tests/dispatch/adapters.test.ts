// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getState, saveCredentials } from "@/lib/dispatch/credentials";
import { readCredentials } from "@/lib/dispatch/credentials";
import type { Db } from "@/lib/dispatch/db/client";
import type { Asset, Work } from "@/lib/dispatch/db/schema";
import { arena } from "@/lib/dispatch/platforms/arena";
import { bluesky } from "@/lib/dispatch/platforms/bluesky";
import { linkedin } from "@/lib/dispatch/platforms/linkedin";
import { threads } from "@/lib/dispatch/platforms/threads";
import { tumblr } from "@/lib/dispatch/platforms/tumblr";
import { PlatformError, type AdapterContext, type PlatformErrorKind } from "@/lib/dispatch/platforms/types";
import { x } from "@/lib/dispatch/platforms/x";
import { cleanEnv, json, routeFetch, testDb } from "./helpers";

const NOW = new Date("2026-10-01T09:00:00Z");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

let restore: () => void = () => {};
let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(() => restore());

const work = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "poster",
  title: "Poster",
  caption: "A caption",
  client: null,
  tools: [],
  tags: ["poster", "print"],
  year: 2026,
} as unknown as Work;

function asset(position: number): Asset {
  return {
    id: `a${position}`,
    workId: work.id,
    position,
    kind: "image",
    displayUrl: `https://blob.test/${position}-display.webp`,
    thumbUrl: `https://blob.test/${position}-thumb.webp`,
    socialUrl: `https://blob.test/${position}-social.jpg`,
    bskyUrl: `https://blob.test/${position}-bsky.jpg`,
    width: 1200,
    height: 1500,
    alt: `alt ${position}`,
  };
}

const blobRoute: [string, () => Response] = ["https://blob.test/", () => new Response(JPEG, { headers: { "Content-Type": "image/jpeg" } })];

function ctx(fetch: typeof globalThis.fetch, state?: AdapterContext["state"]): AdapterContext {
  return { db, now: NOW, fetch, sleep: async () => {}, deadline: Date.now() + 60_000, state };
}

async function expectKind(promise: Promise<unknown>, kind: PlatformErrorKind): Promise<PlatformError> {
  const err = await promise.then(
    () => null,
    (e) => e
  );
  expect(err).toBeInstanceOf(PlatformError);
  expect((err as PlatformError).kind).toBe(kind);
  return err as PlatformError;
}

const payload = (n = 1) => ({ work, assets: Array.from({ length: n }, (_, i) => asset(i)), text: "A caption\n\nhttps://emillavinen.com/work/poster", link: "https://emillavinen.com/work/poster" });
const netFail = () => {
  throw new TypeError("fetch failed");
};

// ── Are.na ─────────────────────────────────────────────────────────────────

describe("Are.na", () => {
  beforeEach(() => {
    restore = cleanEnv({ ARENA_TOKEN: "tok", ARENA_CHANNEL: "emillavinen" });
  });

  it("creates one image block per image from the social URL", async () => {
    let n = 0;
    const f = routeFetch([["https://api.are.na/v3/blocks", () => json({ id: 100 + ++n }, 201)]]);
    const result = await arena.post(ctx(f), payload(2));
    expect(result).toEqual({ remoteId: "101,102", remoteUrl: "https://www.are.na/block/101" });
    const body = JSON.parse(String(f.calls[0].init?.body));
    expect(body).toMatchObject({ value: asset(0).socialUrl, title: "Poster (1/2)", description: payload().text, alt_text: "alt 0", channel_ids: ["emillavinen"] });
    expect((f.calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("keeps what landed when a later block fails, instead of retrying into duplicates", async () => {
    let n = 0;
    const f = routeFetch([["https://api.are.na/v3/blocks", () => (++n === 1 ? json({ id: 7 }, 201) : new Response("boom", { status: 502 }))]]);
    const result = await arena.post(ctx(f), payload(2));
    expect(result).toMatchObject({ remoteId: "7", note: "1 of 2 images added" });
  });

  it("maps every error type", async () => {
    await expectKind(arena.post(ctx(routeFetch([["https://api.are.na", () => new Response("no", { status: 401 })]])), payload()), "auth");
    const limited = await expectKind(
      arena.post(ctx(routeFetch([["https://api.are.na", () => new Response("slow", { status: 429, headers: { "x-ratelimit-reset": "1790848800" } })]])), payload()),
      "rate_limited"
    );
    expect(limited.retryAt?.toISOString()).toBe("2026-10-01T10:00:00.000Z");
    await expectKind(arena.post(ctx(routeFetch([["https://api.are.na", () => new Response("bad", { status: 503 })]])), payload()), "transient");
    await expectKind(arena.post(ctx(routeFetch([["https://api.are.na", () => new Response("bad", { status: 422 })]])), payload()), "rejected");
    await expectKind(arena.post(ctx(routeFetch([["https://api.are.na", netFail]])), payload()), "ambiguous");
  });

  it("check reads /me and the channel, and never posts", async () => {
    const f = routeFetch([
      ["https://api.are.na/v3/me", () => json({ slug: "emil-lavinen" })],
      ["https://api.are.na/v3/channels/emillavinen", () => json({ slug: "emillavinen", title: "e", visibility: "private", abilities: { add_to: true } })],
    ]);
    expect(await arena.check(ctx(f))).toEqual({ account: "emil-lavinen", detail: "channel emillavinen · private channel" });
    expect(f.calls.every((c) => (c.init?.method ?? "GET") === "GET")).toBe(true);
    const cannot = routeFetch([
      ["https://api.are.na/v3/me", () => json({ slug: "emil-lavinen" })],
      ["https://api.are.na/v3/channels/", () => json({ slug: "emillavinen", abilities: { add_to: false } })],
    ]);
    await expectKind(arena.check(ctx(cannot)), "auth");
  });

  it("is configured only with both env vars", () => {
    expect(arena.configured(undefined)).toBe(true);
    process.env.ARENA_CHANNEL = "";
    expect(arena.configured(undefined)).toBe(false);
    expect(arena.missingEnv()).toEqual(["ARENA_CHANNEL"]);
  });
});

// ── X ──────────────────────────────────────────────────────────────────────

const OAUTH1 = { X_API_KEY: "k", X_API_SECRET: "ks", X_ACCESS_TOKEN: "t", X_ACCESS_TOKEN_SECRET: "ts" };

describe("X", () => {
  const happy = () => {
    let media = 0;
    return routeFetch([
      blobRoute,
      ["https://api.x.com/2/media/upload", () => json({ data: { id: String(900 + ++media), media_key: "3_1" } })],
      ["https://api.x.com/2/media/metadata", () => json({ data: { id: "901" } })],
      ["https://api.x.com/2/tweets", () => json({ data: { id: "1234", text: "Poster" } }, 201)],
    ]);
  };

  it("uploads through v2 media, sets alt text, posts with the media ids (OAuth 1.0a)", async () => {
    restore = cleanEnv(OAUTH1);
    const f = happy();
    const result = await x.post(ctx(f, { account: "@emillavinen" } as AdapterContext["state"]), payload(2));
    expect(result).toEqual({ remoteId: "1234", remoteUrl: "https://x.com/emillavinen/status/1234" });
    const upload = f.calls.find((c) => c.url === "https://api.x.com/2/media/upload")!;
    expect(upload.init?.body).toBeInstanceOf(FormData);
    expect((upload.init?.body as FormData).get("media_category")).toBe("tweet_image");
    expect(String((upload.init?.headers as Record<string, string>).Authorization)).toMatch(/^OAuth /);
    const meta = f.calls.find((c) => c.url.endsWith("/media/metadata"))!;
    expect(JSON.parse(String(meta.init?.body))).toEqual({ id: "901", metadata: { alt_text: { text: "alt 0" } } });
    const tweet = f.calls.find((c) => c.url.endsWith("/2/tweets"))!;
    expect(JSON.parse(String(tweet.init?.body))).toEqual({ text: payload().text, media: { media_ids: ["901", "902"] } });
    expect(f.calls.some((c) => c.url.includes("command=INIT") || c.url.includes("/1.1/"))).toBe(false);
  });

  it("402 is out of credits; 403 duplicate is rejected; 429 waits for the reset", async () => {
    restore = cleanEnv(OAUTH1);
    const on = (res: () => Response) =>
      routeFetch([blobRoute, ["https://api.x.com/2/media", () => json({ data: { id: "1" } })], ["https://api.x.com/2/tweets", res]]);
    const credits = await expectKind(x.post(ctx(on(() => json({ title: "CreditsDepleted" }, 402))), payload()), "credits");
    expect(credits.message).toMatch(/top up X credits/);
    await expectKind(x.post(ctx(on(() => json({ detail: "You are not allowed to create a Tweet with duplicate content." }, 403))), payload()), "rejected");
    await expectKind(x.post(ctx(on(() => json({ detail: "Forbidden" }, 403))), payload()), "auth");
    const rl = await expectKind(x.post(ctx(on(() => new Response("", { status: 429, headers: { "x-rate-limit-reset": "1790850000" } }))), payload()), "rate_limited");
    expect(rl.retryAt?.getTime()).toBe(1790850000 * 1000);
    await expectKind(x.post(ctx(on(() => new Response("", { status: 503 }))), payload()), "transient");
    await expectKind(x.post(ctx(on(netFail)), payload()), "ambiguous");
  });

  it("OAuth 1.0a upload 401 without OAuth 2.0 says what to connect", async () => {
    restore = cleanEnv(OAUTH1);
    const f = routeFetch([blobRoute, ["https://api.x.com/2/media/upload", () => json({ title: "Unauthorized" }, 401)]]);
    const err = await expectKind(x.post(ctx(f), payload()), "auth");
    expect(err.message).toMatch(/connect X with OAuth 2.0/);
  });

  it("falls back to OAuth 2.0 for uploads when OAuth 1.0a upload answers 401", async () => {
    restore = cleanEnv({ ...OAUTH1, X_CLIENT_ID: "cid", DISPATCH_ENCRYPTION_KEY: "k" });
    await saveCredentials(db, "x", NOW, { accessToken: "at2", refreshToken: "rt2", expiresAt: NOW.getTime() + 3600_000 });
    const f = routeFetch([
      blobRoute,
      [
        "https://api.x.com/2/media/upload",
        (_url, init) =>
          String((init?.headers as Record<string, string>).Authorization).startsWith("Bearer at2") ? json({ data: { id: "55" } }) : json({ title: "Unauthorized" }, 401),
      ],
      ["https://api.x.com/2/media/metadata", () => json({ data: { id: "55" } })],
      ["https://api.x.com/2/tweets", () => json({ data: { id: "9" } }, 201)],
    ]);
    const result = await x.post(ctx(f, await getState(db, "x")), payload());
    expect(result.remoteId).toBe("9");
    const tweet = f.calls.find((c) => c.url.endsWith("/2/tweets"))!;
    expect(String((tweet.init?.headers as Record<string, string>).Authorization)).toMatch(/^OAuth /); // posting stays on OAuth 1.0a
  });

  it("OAuth 2.0 only: refreshes an expired token and saves the rotated refresh token first", async () => {
    restore = cleanEnv({ X_CLIENT_ID: "cid", X_CLIENT_SECRET: "cs", DISPATCH_ENCRYPTION_KEY: "k" });
    await saveCredentials(db, "x", NOW, { accessToken: "old", refreshToken: "rt-1", expiresAt: NOW.getTime() - 1000 });
    const f = routeFetch([
      ["https://api.x.com/2/oauth2/token", () => json({ access_token: "new", refresh_token: "rt-2", expires_in: 7200 })],
      ...happy().calls.length ? [] : [],
      blobRoute,
      ["https://api.x.com/2/media/upload", () => json({ data: { id: "1" } })],
      ["https://api.x.com/2/media/metadata", () => json({ data: { id: "1" } })],
      ["https://api.x.com/2/tweets", () => json({ data: { id: "2" } }, 201)],
    ]);
    const state = await getState(db, "x");
    expect(x.configured(state)).toBe(true);
    await x.post(ctx(f, state), payload());
    const tokenCall = f.calls.find((c) => c.url.includes("oauth2/token"))!;
    expect(String(tokenCall.init?.body)).toContain("grant_type=refresh_token");
    expect(String(tokenCall.init?.body)).toContain("refresh_token=rt-1");
    expect((tokenCall.init?.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("cid:cs").toString("base64")}`);
    expect(readCredentials<{ refreshToken: string }>(await getState(db, "x"))?.refreshToken).toBe("rt-2");
    const tweet = f.calls.find((c) => c.url.endsWith("/2/tweets"))!;
    expect((tweet.init?.headers as Record<string, string>).Authorization).toBe("Bearer new");
    expect(f.calls.filter((c) => c.url.includes("oauth2/token"))).toHaveLength(1);
  });

  it("bootstraps OAuth 2.0 from X_OAUTH2_REFRESH_TOKEN once, then uses the stored token", async () => {
    restore = cleanEnv({ X_CLIENT_ID: "cid", DISPATCH_ENCRYPTION_KEY: "k", X_OAUTH2_REFRESH_TOKEN: "env-rt" });
    const f = routeFetch([
      ["https://api.x.com/2/oauth2/token", () => json({ access_token: "a1", refresh_token: "r1", expires_in: 7200 })],
      ["https://api.x.com/2/users/me", () => json({ data: { username: "emillavinen" } })],
    ]);
    expect(await x.check(ctx(f))).toEqual({ account: "@emillavinen", detail: "OAuth 2.0" });
    expect(String(f.calls[0].init?.body)).toContain("refresh_token=env-rt");
    const state = await getState(db, "x");
    await x.check(ctx(f, state));
    expect(f.calls.filter((c) => c.url.includes("oauth2/token"))).toHaveLength(1);
  });

  it("a refused refresh is an auth problem (reconnect)", async () => {
    restore = cleanEnv({ X_CLIENT_ID: "cid", DISPATCH_ENCRYPTION_KEY: "k" });
    await saveCredentials(db, "x", NOW, { accessToken: "old", refreshToken: "used", expiresAt: 0 });
    const f = routeFetch([["https://api.x.com/2/oauth2/token", () => json({ error: "invalid_request" }, 400)]]);
    const err = await expectKind(x.check(ctx(f, await getState(db, "x"))), "auth");
    expect(err.message).toMatch(/reconnect X/);
  });

  it("connect flow uses PKCE with the right scopes", () => {
    restore = cleanEnv({ X_CLIENT_ID: "cid" });
    const start = x.oauth!.start({ state: "st", redirectUri: "https://emillavinen.com/api/auth/x/callback" });
    const url = new URL(start.url);
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe("tweet.read tweet.write users.read media.write offline.access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(start.verifier).toBeTruthy();
  });
});

// ── Threads ────────────────────────────────────────────────────────────────

describe("Threads", () => {
  beforeEach(async () => {
    restore = cleanEnv({ THREADS_APP_ID: "app", THREADS_APP_SECRET: "sec", DISPATCH_ENCRYPTION_KEY: "k" });
    await saveCredentials(db, "threads", NOW, { accessToken: "tt", userId: "42" }, { tokenExpiresAt: new Date(NOW.getTime() + 50 * 86400_000), refreshed: true });
  });

  function graph(opts: { status?: string[]; publish?: () => Response } = {}) {
    let container = 0;
    let polls = 0;
    const statuses = opts.status ?? ["IN_PROGRESS", "FINISHED"];
    return routeFetch([
      ["https://graph.threads.net/v1.0/42/threads_publish", opts.publish ?? (() => json({ id: "post-1" }))],
      ["https://graph.threads.net/v1.0/42/threads", () => json({ id: `c${++container}` })],
      [/graph\.threads\.net\/v1\.0\/c\d+\?fields=status/, () => json({ status: statuses[Math.min(polls++, statuses.length - 1)] })],
      [/graph\.threads\.net\/v1\.0\/post-1\?fields=permalink/, () => json({ permalink: "https://www.threads.net/@emil/post/abc" })],
    ]);
  }

  it("single image: IMAGE container, poll until FINISHED, publish", async () => {
    const f = graph();
    const result = await threads.post(ctx(f, await getState(db, "threads")), payload());
    expect(result).toEqual({ remoteId: "post-1", remoteUrl: "https://www.threads.net/@emil/post/abc" });
    const create = new URLSearchParams(String(f.calls[0].init?.body));
    expect(Object.fromEntries(create)).toMatchObject({ media_type: "IMAGE", image_url: asset(0).socialUrl, text: payload().text });
    expect(f.calls.filter((c) => c.url.includes("fields=status"))).toHaveLength(2);
    expect(new URLSearchParams(String(f.calls.find((c) => c.url.endsWith("threads_publish"))!.init?.body)).get("creation_id")).toBe("c1");
  });

  it("several images: carousel items, then a CAROUSEL container", async () => {
    const f = graph({ status: ["FINISHED"] });
    await threads.post(ctx(f, await getState(db, "threads")), payload(3));
    const creates = f.calls.filter((c) => c.url.endsWith("/42/threads")).map((c) => Object.fromEntries(new URLSearchParams(String(c.init?.body))));
    expect(creates.slice(0, 3).every((c) => c.is_carousel_item === "true" && c.media_type === "IMAGE")).toBe(true);
    expect(creates[3]).toMatchObject({ media_type: "CAROUSEL", children: "c1,c2,c3", text: payload().text });
  });

  it("container ERROR is rejected; token error 190 is auth; publish network error is ambiguous", async () => {
    const state = await getState(db, "threads");
    await expectKind(threads.post(ctx(graph({ status: ["ERROR"] }), state), payload()), "rejected");
    const expired = routeFetch([["https://graph.threads.net", () => json({ error: { code: 190, message: "Session expired" } }, 400)]]);
    await expectKind(threads.post(ctx(expired, state), payload()), "auth");
    await expectKind(threads.post(ctx(graph({ publish: netFail }), state), payload()), "ambiguous");
  });

  it("refreshes the long-lived token once it is over 24 hours old", async () => {
    const f = routeFetch([["https://graph.threads.net/refresh_access_token", () => json({ access_token: "tt2", expires_in: 5184000 })]]);
    const fresh = await threads.maintain!(ctx(f, await getState(db, "threads")));
    expect(f.calls).toHaveLength(0);
    expect(fresh && fresh.expiresAt).toBeTruthy();
    const later = { ...ctx(f, await getState(db, "threads")), now: new Date(NOW.getTime() + 25 * 3600_000) };
    const result = await threads.maintain!(later);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toContain("grant_type=th_refresh_token");
    expect(result && result.expiresAt?.getTime()).toBe(later.now.getTime() + 5184000 * 1000);
    expect(readCredentials<{ accessToken: string }>(await getState(db, "threads"))?.accessToken).toBe("tt2");
  });
});

// ── LinkedIn ───────────────────────────────────────────────────────────────

describe("LinkedIn", () => {
  beforeEach(async () => {
    restore = cleanEnv({ LINKEDIN_CLIENT_ID: "id", LINKEDIN_CLIENT_SECRET: "s", LINKEDIN_VERSION: "202609", DISPATCH_ENCRYPTION_KEY: "k" });
    await saveCredentials(db, "linkedin", NOW, { accessToken: "lt", personUrn: "urn:li:person:abc" }, { tokenExpiresAt: new Date(NOW.getTime() + 30 * 86400_000) });
  });

  function api(post: () => Response = () => new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:77" } })) {
    let n = 0;
    return routeFetch([
      blobRoute,
      ["https://api.linkedin.com/rest/images?action=initializeUpload", () => json({ value: { uploadUrl: `https://upload.linkedin.test/${++n}`, image: `urn:li:image:I${n}` } })],
      ["https://upload.linkedin.test/", () => new Response(null, { status: 201 })],
      ["https://api.linkedin.com/rest/posts", post],
    ]);
  }

  it("uploads through the Images API and posts as the member, with LINKEDIN_VERSION", async () => {
    const f = api();
    const text = "Poster\n\nhttps://emillavinen.com/work/poster?utm_source=linkedin";
    const result = await linkedin.post(ctx(f, await getState(db, "linkedin")), { ...payload(), text });
    expect(result).toEqual({ remoteId: "urn:li:share:77", remoteUrl: "https://www.linkedin.com/feed/update/urn:li:share:77/" });
    const post = f.calls.find((c) => c.url.endsWith("/rest/posts"))!;
    const headers = post.init?.headers as Record<string, string>;
    expect(headers["LinkedIn-Version"]).toBe("202609");
    expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    const body = JSON.parse(String(post.init?.body));
    expect(body).toMatchObject({ author: "urn:li:person:abc", visibility: "PUBLIC", lifecycleState: "PUBLISHED", content: { media: { id: "urn:li:image:I1", altText: "alt 0" } } });
    expect(body.commentary).toContain("utm\\_source");
    const init = f.calls.find((c) => c.url.includes("initializeUpload"))!;
    expect(JSON.parse(String(init.init?.body))).toEqual({ initializeUploadRequest: { owner: "urn:li:person:abc" } });
  });

  it("several images become a multiImage post", async () => {
    const f = api();
    await linkedin.post(ctx(f, await getState(db, "linkedin")), payload(2));
    const body = JSON.parse(String(f.calls.find((c) => c.url.endsWith("/rest/posts"))!.init?.body));
    expect(body.content.multiImage.images.map((i: { id: string }) => i.id)).toEqual(["urn:li:image:I1", "urn:li:image:I2"]);
  });

  it("a retired version pauses the platform with a note about LINKEDIN_VERSION", async () => {
    const f = api(() => json({ message: "Requested version 20240101 is not active", status: 426 }, 426));
    const err = await expectKind(linkedin.post(ctx(f, await getState(db, "linkedin")), payload()), "auth");
    expect(err.message).toMatch(/LINKEDIN_VERSION/);
    await expectKind(linkedin.post(ctx(api(() => new Response("", { status: 401 })), await getState(db, "linkedin")), payload()), "auth");
    await expectKind(linkedin.post(ctx(api(() => new Response("", { status: 500 })), await getState(db, "linkedin")), payload()), "transient");
    await expectKind(linkedin.post(ctx(api(() => json({ message: "FIELD_LENGTH_TOO_LONG" }, 422)), await getState(db, "linkedin")), payload()), "rejected");
  });

  it("is not configured without LINKEDIN_VERSION (never hardcoded)", async () => {
    const state = await getState(db, "linkedin");
    expect(linkedin.configured(state)).toBe(true);
    delete process.env.LINKEDIN_VERSION;
    expect(linkedin.configured(state)).toBe(false);
    expect(linkedin.missingEnv()).toContain("LINKEDIN_VERSION");
  });

  it("reports the expiry so the runner can warn 7 days ahead", async () => {
    const result = await linkedin.maintain!(ctx(routeFetch([]), await getState(db, "linkedin")));
    expect(result && result.expiresAt?.toISOString()).toBe(new Date(NOW.getTime() + 30 * 86400_000).toISOString());
  });
});

// ── Bluesky ────────────────────────────────────────────────────────────────

describe("Bluesky", () => {
  beforeEach(() => {
    restore = cleanEnv({ BSKY_HANDLE: "emil.bsky.social", BSKY_APP_PASSWORD: "app-pass" });
  });

  const session = () =>
    json({ accessJwt: "a.b.c", refreshJwt: "d.e.f", handle: "emil.bsky.social", did: "did:plc:abcdefghijklmnopqrstuvwx", active: true });
  const blob = {
    $type: "blob",
    ref: { $link: "bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy" },
    mimeType: "image/jpeg",
    size: 4,
  };

  function pds(createRecord: () => Response = () => json({ uri: "at://did:plc:abcdefghijklmnopqrstuvwx/app.bsky.feed.post/3kabc", cid: "bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm" })) {
    return routeFetch([
      blobRoute,
      ["https://bsky.social/xrpc/com.atproto.server.createSession", session],
      ["https://bsky.social/xrpc/com.atproto.repo.uploadBlob", () => json({ blob })],
      ["https://bsky.social/xrpc/com.atproto.repo.createRecord", createRecord],
    ]);
  }

  it("posts the bsky variant with alt text, aspect ratio and a link facet", async () => {
    const f = pds();
    const text = "Poster\n\nhttps://emillavinen.com/work/poster?utm_source=bluesky";
    const result = await bluesky.post(ctx(f), { ...payload(), text });
    expect(result).toEqual({
      remoteId: "at://did:plc:abcdefghijklmnopqrstuvwx/app.bsky.feed.post/3kabc",
      remoteUrl: "https://bsky.app/profile/emil.bsky.social/post/3kabc",
    });
    expect(f.calls.some((c) => c.url === asset(0).bskyUrl)).toBe(true);
    const record = JSON.parse(String(f.calls.find((c) => c.url.includes("createRecord"))!.init?.body)).record;
    expect(record.text).toBe(text);
    expect(record.embed.images[0]).toMatchObject({ alt: "alt 0", aspectRatio: { width: 1200, height: 1500 } });
    expect(record.facets[0].features[0].uri).toBe("https://emillavinen.com/work/poster?utm_source=bluesky");
  });

  it("wrong app password is auth; 429 waits; 5xx retries; network on the post is ambiguous", async () => {
    const badLogin = routeFetch([["https://bsky.social/xrpc/com.atproto.server.createSession", () => json({ error: "AuthenticationRequired", message: "Invalid identifier or password" }, 401)]]);
    await expectKind(bluesky.post(ctx(badLogin), payload()), "auth");
    const rl = await expectKind(
      bluesky.post(ctx(pds(() => json({ error: "RateLimitExceeded" }, 429, { "ratelimit-reset": "1790850000" }))), payload()),
      "rate_limited"
    );
    expect(rl.retryAt?.getTime()).toBe(1790850000 * 1000);
    await expectKind(bluesky.post(ctx(pds(() => json({ error: "InternalServerError" }, 500))), payload()), "transient");
    await expectKind(bluesky.post(ctx(pds(netFail)), payload()), "ambiguous");
  });
});

// ── Tumblr ─────────────────────────────────────────────────────────────────

describe("Tumblr", () => {
  beforeEach(() => {
    restore = cleanEnv({ TUMBLR_CONSUMER_KEY: "ck", TUMBLR_CONSUMER_SECRET: "cs", TUMBLR_TOKEN: "t", TUMBLR_TOKEN_SECRET: "ts", TUMBLR_BLOG: "emillavinen" });
  });

  it("posts NPF as multipart: json first, then the images, with tags", async () => {
    const f = routeFetch([blobRoute, ["https://api.tumblr.com/v2/blog/emillavinen.tumblr.com/posts", () => json({ meta: { status: 201 }, response: { id: 123, id_string: "123" } }, 201)]]);
    const result = await tumblr.post(ctx(f), payload(2));
    expect(result).toEqual({ remoteId: "123", remoteUrl: "https://www.tumblr.com/emillavinen/123" });
    const call = f.calls.find((c) => c.url.includes("/posts"))!;
    const form = call.init?.body as FormData;
    const keys = [...form.keys()];
    expect(keys).toEqual(["json", "image-0", "image-1"]);
    const npf = JSON.parse(await (form.get("json") as Blob).text());
    expect(npf.tags).toBe("poster,print");
    expect(npf.content[0]).toMatchObject({ type: "image", media: [{ identifier: "image-0", type: "image/jpeg" }], alt_text: "alt 0" });
    expect(npf.content.find((b: { subtype?: string }) => b.subtype === "heading1").text).toBe("Poster");
    expect(String((call.init?.headers as Record<string, string>).Authorization)).toMatch(/^OAuth .*oauth_signature=/);
  });

  it("maps errors", async () => {
    await expectKind(tumblr.post(ctx(routeFetch([blobRoute, ["https://api.tumblr.com", () => json({}, 401)]])), payload()), "auth");
    await expectKind(tumblr.post(ctx(routeFetch([blobRoute, ["https://api.tumblr.com", () => json({}, 400)]])), payload()), "rejected");
    await expectKind(tumblr.post(ctx(routeFetch([blobRoute, ["https://api.tumblr.com", netFail]])), payload()), "ambiguous");
  });
});
