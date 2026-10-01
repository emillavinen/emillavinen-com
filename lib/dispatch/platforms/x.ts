import twitter from "twitter-text";
import { env, envBool } from "../config";
import { canEncrypt, randomToken, sha256Base64Url } from "../crypto";
import { readCredentials, saveCredentials, withLease, getState } from "../credentials";
import { fetchBytes } from "../blob";
import { clean, joinPresent, truncate } from "./format";
import { expectJson, send } from "./http";
import { oauth1Header, type OAuth1Keys } from "./oauth1";
import { PlatformError, type Adapter, type AdapterContext } from "./types";

/**
 * X, API v2 (https://docs.x.com and https://api.x.com/2/openapi.json,
 * checked 2026-09-30). Pay-per-use: every request spends credits.
 *
 * - Media: `POST /2/media/upload` (multipart, media_category=tweet_image),
 *   alt text through `POST /2/media/metadata`. Not v1.1, not command=INIT.
 * - Post: `POST /2/tweets` with the media ids.
 * - Auth: OAuth 1.0a user context from the four env keys when all are set.
 *   OAuth 2.0 user context (PKCE, connected from /admin) is used for uploads
 *   when OAuth 1.0a upload answers 401, and for everything when the OAuth 1.0a
 *   keys are not there. X rotates refresh tokens, so every refresh saves the
 *   new one under the platform lease before the new access token is used.
 * - No link by default (X_INCLUDE_LINK=false): a post with a URL costs far more.
 */

const API = "https://api.x.com/2";
const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_SCOPES = "tweet.read tweet.write users.read media.write offline.access";

interface OAuth2Creds {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

function oauth1Keys(): OAuth1Keys | null {
  const consumerKey = env("X_API_KEY");
  const consumerSecret = env("X_API_SECRET");
  const token = env("X_ACCESS_TOKEN");
  const tokenSecret = env("X_ACCESS_TOKEN_SECRET");
  return consumerKey && consumerSecret && token && tokenSecret ? { consumerKey, consumerSecret, token, tokenSecret } : null;
}

function oauth2Client(): { id: string; secret?: string } | null {
  const id = env("X_CLIENT_ID");
  return id ? { id, secret: env("X_CLIENT_SECRET") } : null;
}

export function xWeightedLength(text: string): number {
  return twitter.parseTweet(text).weightedLength;
}

function classify(status: number, body: string): PlatformError | null {
  const lower = body.toLowerCase();
  if (status === 402 || lower.includes("usagecapexceeded") || lower.includes("credits")) {
    return new PlatformError("credits", "Out of X credits — top up X credits in the developer console", { status });
  }
  if (status === 403 && lower.includes("duplicate")) {
    return new PlatformError("rejected", "X refused a duplicate post", { status });
  }
  return null;
}

async function tokenRequest(ctx: AdapterContext, params: Record<string, string>): Promise<OAuth2Creds> {
  const client = oauth2Client();
  if (!client) throw new PlatformError("auth", "X_CLIENT_ID is not set");
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (client.secret) headers.Authorization = `Basic ${Buffer.from(`${client.id}:${client.secret}`).toString("base64")}`;
  const res = await send(ctx.fetch, TOKEN_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams({ ...params, client_id: client.id }).toString(),
  });
  const json = await expectJson<{ access_token: string; refresh_token?: string; expires_in?: number }>(res, "X token", ctx.now, {
    classify: (status, body) =>
      status === 400 || status === 401
        ? new PlatformError("auth", `X refused the OAuth 2.0 token request (${body.slice(0, 160)}) — reconnect X in /admin/connections`, { status })
        : null,
  });
  if (!json.refresh_token) throw new PlatformError("auth", "X returned no refresh token — the offline.access scope is missing");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: ctx.now.getTime() + (json.expires_in ?? 7200) * 1000,
  };
}

/** A valid OAuth 2.0 access token, refreshing (and saving the rotated refresh token) when needed. */
async function oauth2AccessToken(ctx: AdapterContext): Promise<string> {
  const fresh = (c: OAuth2Creds | null) => c && c.expiresAt - 120_000 > ctx.now.getTime();
  const current = readCredentials<OAuth2Creds>(ctx.state ?? (await getState(ctx.db, "x")));
  if (current && fresh(current)) return current.accessToken;

  const result = await withLease(
    ctx.db,
    "x",
    ctx.now,
    async () => {
      // Re-read inside the lease: another run may have just rotated the token.
      const latest = readCredentials<OAuth2Creds>(await getState(ctx.db, "x"));
      if (latest && fresh(latest)) return latest.accessToken;
      const refreshToken = latest?.refreshToken ?? env("X_OAUTH2_REFRESH_TOKEN");
      if (!refreshToken) throw new PlatformError("auth", "X OAuth 2.0 is not connected — connect X in /admin/connections");
      const next = await tokenRequest(ctx, { grant_type: "refresh_token", refresh_token: refreshToken });
      // The access token lives two hours and refreshes itself, so it is not
      // recorded as an expiry Emil needs to hear about.
      await saveCredentials(ctx.db, "x", ctx.now, next, { refreshed: true });
      return next.accessToken;
    },
    { sleep: ctx.sleep }
  );
  if (!result) throw new PlatformError("transient", "Another run is refreshing the X token");
  return result;
}

function hasOAuth2(ctx: AdapterContext): boolean {
  if (!oauth2Client() || !canEncrypt()) return false;
  return Boolean(ctx.state?.credentials || env("X_OAUTH2_REFRESH_TOKEN"));
}

type AuthMode = "oauth1" | "oauth2";

async function authHeader(ctx: AdapterContext, mode: AuthMode, method: string, url: string): Promise<string> {
  if (mode === "oauth1") {
    const keys = oauth1Keys();
    if (!keys) throw new PlatformError("auth", "X OAuth 1.0a keys are not set");
    return oauth1Header(method, url, keys);
  }
  return `Bearer ${await oauth2AccessToken(ctx)}`;
}

function postingMode(ctx: AdapterContext): AuthMode {
  return oauth1Keys() ? "oauth1" : hasOAuth2(ctx) ? "oauth2" : "oauth1";
}

async function uploadOnce(ctx: AdapterContext, mode: AuthMode, bytes: Buffer): Promise<string> {
  const url = `${API}/media/upload`;
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "image.jpg");
  form.append("media_category", "tweet_image");
  const res = await send(ctx.fetch, url, {
    method: "POST",
    headers: { Authorization: await authHeader(ctx, mode, "POST", url) },
    body: form,
    timeoutMs: 60_000,
  });
  const json = await expectJson<{ data?: { id: string; processing_info?: { state: string; check_after_secs?: number } } }>(
    res,
    "X POST /2/media/upload",
    ctx.now,
    { classify }
  );
  const id = json.data?.id;
  if (!id) throw new PlatformError("transient", "X media upload returned no id");
  let info = json.data?.processing_info;
  while (info && (info.state === "pending" || info.state === "in_progress")) {
    if (Date.now() > ctx.deadline) throw new PlatformError("transient", "X media still processing at the end of the run");
    await ctx.sleep(Math.max(1, info.check_after_secs ?? 1) * 1000);
    const statusUrl = `${API}/media/upload?command=STATUS&media_id=${encodeURIComponent(id)}`;
    const status = await expectJson<{ data?: { processing_info?: { state: string; check_after_secs?: number } } }>(
      await send(ctx.fetch, statusUrl, { headers: { Authorization: await authHeader(ctx, mode, "GET", statusUrl) } }),
      "X GET /2/media/upload STATUS",
      ctx.now,
      { classify }
    );
    info = status.data?.processing_info;
  }
  if (info?.state === "failed") throw new PlatformError("rejected", "X could not process the image");
  return id;
}

async function uploadImage(ctx: AdapterContext, bytes: Buffer): Promise<{ id: string; mode: AuthMode }> {
  const mode = postingMode(ctx);
  try {
    return { id: await uploadOnce(ctx, mode, bytes), mode };
  } catch (err) {
    // Some pay-per-use apps get 401 from v2 media upload under OAuth 1.0a
    // while posting works. Fall back to OAuth 2.0 for the upload.
    if (mode === "oauth1" && err instanceof PlatformError && err.status === 401) {
      if (!hasOAuth2(ctx)) {
        throw new PlatformError("auth", "X media upload rejected OAuth 1.0a (401) — connect X with OAuth 2.0 in /admin/connections", { status: 401 });
      }
      return { id: await uploadOnce(ctx, "oauth2", bytes), mode: "oauth2" };
    }
    throw err;
  }
}

async function setAltText(ctx: AdapterContext, mode: AuthMode, mediaId: string, alt: string): Promise<void> {
  const url = `${API}/media/metadata`;
  try {
    const res = await send(ctx.fetch, url, {
      method: "POST",
      headers: { Authorization: await authHeader(ctx, mode, "POST", url), "Content-Type": "application/json" },
      body: JSON.stringify({ id: mediaId, metadata: { alt_text: { text: alt.slice(0, 1000) } } }),
    });
    await expectJson(res, "X POST /2/media/metadata", ctx.now, { classify });
  } catch (err) {
    // Alt text is worth having but not worth losing the post over.
    console.warn("[dispatch] x alt text failed", err instanceof Error ? err.message : err);
  }
}

export const x: Adapter = {
  platform: "x",
  maxImages: 4,

  missingEnv() {
    // Either the four OAuth 1.0a keys, or an OAuth 2.0 client to connect with.
    if (oauth1Keys() || (oauth2Client() && canEncrypt())) return [];
    const oauth1 = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"].filter((n) => !env(n));
    const oauth2 = ["X_CLIENT_ID", "DISPATCH_ENCRYPTION_KEY"].filter((n) => !env(n));
    return [`${oauth1.join(", ")} — or ${oauth2.join(" + ")} and Connect`];
  },

  configured(state) {
    if (oauth1Keys()) return true;
    return Boolean(oauth2Client() && canEncrypt() && (state?.credentials || env("X_OAUTH2_REFRESH_TOKEN")));
  },

  format(work, link) {
    const title = clean(work.title);
    const caption = clean(work.caption);
    const tail = envBool("X_INCLUDE_LINK", false) ? link : "";
    const withCaption = joinPresent([title, caption, tail], "\n\n");
    if (caption && xWeightedLength(withCaption) <= 280) return withCaption;
    const titleOnly = joinPresent([title, tail], "\n\n");
    if (xWeightedLength(titleOnly) <= 280) return titleOnly;
    const room = 280 - (tail ? xWeightedLength(`\n\n${tail}`) : 0);
    return joinPresent([truncate(title, room, xWeightedLength), tail], "\n\n");
  },

  async check(ctx) {
    const mode = postingMode(ctx);
    const url = `${API}/users/me`;
    const me = await expectJson<{ data: { username: string } }>(
      await send(ctx.fetch, url, { headers: { Authorization: await authHeader(ctx, mode, "GET", url) } }),
      "X GET /2/users/me",
      ctx.now,
      { classify }
    );
    return { account: `@${me.data.username}`, detail: mode === "oauth1" ? "OAuth 1.0a" : "OAuth 2.0" };
  },

  async post(ctx, { assets, text }) {
    const mediaIds: string[] = [];
    for (const asset of assets.slice(0, x.maxImages)) {
      const { buffer } = await fetchBytes(asset.socialUrl, ctx.fetch).catch((err) => {
        throw new PlatformError("transient", `Could not read the image from storage: ${err instanceof Error ? err.message : err}`);
      });
      const uploaded = await uploadImage(ctx, buffer);
      if (asset.alt) await setAltText(ctx, uploaded.mode, uploaded.id, asset.alt);
      mediaIds.push(uploaded.id);
    }
    const postMode = postingMode(ctx);
    const url = `${API}/tweets`;
    const res = await send(ctx.fetch, url, {
      method: "POST",
      headers: { Authorization: await authHeader(ctx, postMode, "POST", url), "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}) }),
      final: true,
    });
    const json = await expectJson<{ data: { id: string } }>(res, "X POST /2/tweets", ctx.now, { classify, final: true });
    const username = ctx.state?.account?.replace(/^@/, "");
    return {
      remoteId: json.data.id,
      remoteUrl: username ? `https://x.com/${username}/status/${json.data.id}` : `https://x.com/i/web/status/${json.data.id}`,
    };
  },

  oauth: {
    start({ state, redirectUri }) {
      const client = oauth2Client();
      if (!client) throw new Error("X_CLIENT_ID is not set");
      const verifier = randomToken(48);
      const params = new URLSearchParams({
        response_type: "code",
        client_id: client.id,
        redirect_uri: redirectUri,
        scope: X_SCOPES,
        state,
        code_challenge: sha256Base64Url(verifier),
        code_challenge_method: "S256",
      });
      return { url: `${AUTHORIZE_URL}?${params.toString()}`, verifier };
    },
    async finish(ctx, { code, redirectUri, verifier }) {
      if (!verifier) throw new PlatformError("auth", "Missing PKCE verifier");
      const creds = await tokenRequest(ctx, {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });
      const url = `${API}/users/me`;
      const me = await expectJson<{ data: { username: string } }>(
        await send(ctx.fetch, url, { headers: { Authorization: `Bearer ${creds.accessToken}` } }),
        "X GET /2/users/me",
        ctx.now,
        { classify }
      );
      await saveCredentials(ctx.db, "x", ctx.now, creds, { account: `@${me.data.username}`, refreshed: true });
      return { account: `@${me.data.username}`, detail: "OAuth 2.0" };
    },
  },
};
