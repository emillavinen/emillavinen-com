import { env } from "../config";
import { fetchBytes } from "../blob";
import { fitBlocks, graphemeLength } from "./format";
import { rateLimitReset } from "./http";
import { PlatformError, type Adapter, type AdapterContext } from "./types";

/**
 * Bluesky through @atproto/api with a handle and an app password. Up to four
 * images from the `bsky` variant (kept under 950 KB), each with alt text and
 * aspect ratio; the link becomes a facet via RichText. 300 graphemes.
 */

function service(): string {
  return env("BSKY_SERVICE") ?? "https://bsky.social";
}

function toPlatformError(err: unknown, final: boolean, now: Date): PlatformError {
  if (err instanceof PlatformError) return err;
  const e = err as { status?: number; error?: string; message?: string; headers?: Record<string, string> };
  const status = typeof e?.status === "number" ? e.status : 0;
  const message = `Bluesky: ${e?.error ?? ""} ${e?.message ?? String(err)}`.trim();
  if (status === 429) {
    return new PlatformError("rate_limited", message, { status, retryAt: rateLimitReset(new Headers(e.headers ?? {}), now) });
  }
  if (status === 401 || status === 403 || /AuthFactorTokenRequired|AccountTakedown|InvalidToken|ExpiredToken|AuthenticationRequired/.test(e?.error ?? "")) {
    return new PlatformError("auth", `${message} — check BSKY_HANDLE and BSKY_APP_PASSWORD`, { status });
  }
  if (status >= 500) return new PlatformError("transient", message, { status });
  if (status >= 400) return new PlatformError("rejected", message, { status });
  // No HTTP status: the request never got an answer.
  return new PlatformError(final ? "ambiguous" : "transient", message);
}

async function login(ctx: AdapterContext) {
  const { AtpAgent } = await import("@atproto/api");
  const agent = new AtpAgent({ service: service(), fetch: ctx.fetch });
  try {
    await agent.login({ identifier: env("BSKY_HANDLE")!, password: env("BSKY_APP_PASSWORD")! });
  } catch (err) {
    const pe = toPlatformError(err, false, ctx.now);
    // A 400 from createSession means the password is wrong, not that the post was bad.
    if (pe.kind === "rejected") throw new PlatformError("auth", `${pe.message} — check BSKY_HANDLE and BSKY_APP_PASSWORD`, { status: pe.status });
    throw pe;
  }
  return agent;
}

export const bluesky: Adapter = {
  platform: "bluesky",
  maxImages: 4,

  missingEnv() {
    return ["BSKY_HANDLE", "BSKY_APP_PASSWORD"].filter((n) => !env(n));
  },

  configured() {
    return bluesky.missingEnv().length === 0;
  },

  format(work, link) {
    return fitBlocks({ head: work.title, body: work.caption, tail: link }, 300, graphemeLength);
  },

  async check(ctx) {
    const agent = await login(ctx);
    return { account: `@${agent.session?.handle ?? env("BSKY_HANDLE")}` };
  },

  async post(ctx, { assets, text }) {
    const agent = await login(ctx);
    const { RichText } = await import("@atproto/api");
    const images = [];
    for (const asset of assets.slice(0, bluesky.maxImages)) {
      const { buffer } = await fetchBytes(asset.bskyUrl, ctx.fetch).catch((err) => {
        throw new PlatformError("transient", `Could not read the image from storage: ${err instanceof Error ? err.message : err}`);
      });
      try {
        const uploaded = await agent.uploadBlob(new Uint8Array(buffer), { encoding: "image/jpeg" });
        images.push({ alt: asset.alt, image: uploaded.data.blob, aspectRatio: { width: asset.width, height: asset.height } });
      } catch (err) {
        throw toPlatformError(err, false, ctx.now);
      }
    }
    const rt = new RichText({ text });
    rt.detectFacetsWithoutResolution();
    try {
      const result = await agent.post({
        text: rt.text,
        facets: rt.facets,
        ...(images.length > 0 ? { embed: { $type: "app.bsky.embed.images", images } } : {}),
        createdAt: ctx.now.toISOString(),
      });
      const rkey = result.uri.split("/").pop();
      const handle = agent.session?.handle ?? env("BSKY_HANDLE");
      return { remoteId: result.uri, remoteUrl: rkey && handle ? `https://bsky.app/profile/${handle}/post/${rkey}` : null };
    } catch (err) {
      throw toPlatformError(err, true, ctx.now);
    }
  },
};
