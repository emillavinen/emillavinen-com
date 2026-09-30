import { env } from "../config";
import { canEncrypt } from "../crypto";
import { readCredentials, saveCredentials, getState } from "../credentials";
import { fetchBytes } from "../blob";
import { clean, creditsLine, joinPresent, truncate } from "./format";
import { expectJson, expectOk, send } from "./http";
import { PlatformError, type Adapter, type AdapterContext } from "./types";

/**
 * LinkedIn, on Emil's personal profile (Posts API + Images API,
 * https://learn.microsoft.com/linkedin, checked 2026-09-30). The self-serve
 * "Share on LinkedIn" product grants w_member_social; "Sign In with LinkedIn
 * using OpenID Connect" gives the member id (`sub`) for the author URN.
 * The LinkedIn-Version header always comes from LINKEDIN_VERSION: versions
 * are retired roughly a year after release, and a retired one pauses the
 * platform with a note saying which variable to change.
 */

const REST = "https://api.linkedin.com/rest";
const DAY = 86_400_000;

interface LinkedInCreds {
  accessToken: string;
  refreshToken?: string;
  refreshExpiresAt?: number;
  personUrn: string;
}

function app(): { id: string; secret: string } | null {
  const id = env("LINKEDIN_CLIENT_ID");
  const secret = env("LINKEDIN_CLIENT_SECRET");
  return id && secret ? { id, secret } : null;
}

function version(): string {
  const v = env("LINKEDIN_VERSION");
  if (!v) throw new PlatformError("auth", "LINKEDIN_VERSION is not set (YYYYMM, e.g. the current month's version)");
  return v;
}

function classify(status: number, body: string): PlatformError | null {
  if (status === 426 || /NONEXISTENT_VERSION|VERSION_MISSING|version .*(not active|deprecated|sunset)/i.test(body)) {
    return new PlatformError(
      "auth",
      `LinkedIn API version ${env("LINKEDIN_VERSION") ?? "(unset)"} is not accepted — set LINKEDIN_VERSION to a current YYYYMM version`,
      { status }
    );
  }
  if (status === 401) return new PlatformError("auth", "LinkedIn token expired or revoked — reconnect in /admin/connections", { status });
  return null;
}

function restHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": version(),
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

/** Escapes the characters "little text format" reserves in commentary. */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

function creds(ctx: AdapterContext): LinkedInCreds {
  const c = readCredentials<LinkedInCreds>(ctx.state);
  if (!c) throw new PlatformError("auth", "LinkedIn is not connected — connect it in /admin/connections");
  return c;
}

async function tokenRequest(ctx: AdapterContext, params: Record<string, string>) {
  const a = app();
  if (!a) throw new PlatformError("auth", "LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET are not set");
  return expectJson<{ access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number }>(
    await send(ctx.fetch, "https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...params, client_id: a.id, client_secret: a.secret }).toString(),
    }),
    "LinkedIn token",
    ctx.now,
    { classify: (status) => (status === 400 || status === 401 ? new PlatformError("auth", "LinkedIn refused the token request — reconnect in /admin/connections", { status }) : null) }
  );
}

export const linkedin: Adapter = {
  platform: "linkedin",
  maxImages: 20,

  missingEnv() {
    return ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_VERSION", "DISPATCH_ENCRYPTION_KEY"].filter((n) => !env(n));
  },

  configured(state) {
    return Boolean(app() && env("LINKEDIN_VERSION") && canEncrypt() && state?.credentials);
  },

  format(work, link) {
    // Title, one line of client and tools, the link. Commentary is escaped
    // when it is sent; the limit is LinkedIn's 3,000 characters.
    const head = clean(work.title);
    const credits = creditsLine(work);
    const text = joinPresent([head, credits, link], "\n\n");
    if (text.length <= 2800) return text;
    return joinPresent([truncate(head, 400), truncate(credits, 400), link], "\n\n");
  },

  async check(ctx) {
    const c = creds(ctx);
    const me = await expectJson<{ sub: string; name?: string }>(
      await send(ctx.fetch, "https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${c.accessToken}` } }),
      "LinkedIn GET /v2/userinfo",
      ctx.now,
      { classify }
    );
    return { account: me.name ?? me.sub, detail: `LinkedIn-Version ${version()}` };
  },

  async post(ctx, { assets, text }) {
    const c = creds(ctx);
    const images = assets.slice(0, linkedin.maxImages);
    const uploaded: { id: string; altText: string }[] = [];
    for (const asset of images) {
      const init = await expectJson<{ value: { uploadUrl: string; image: string } }>(
        await send(ctx.fetch, `${REST}/images?action=initializeUpload`, {
          method: "POST",
          headers: restHeaders(c.accessToken),
          body: JSON.stringify({ initializeUploadRequest: { owner: c.personUrn } }),
        }),
        "LinkedIn initializeUpload",
        ctx.now,
        { classify }
      );
      const { buffer } = await fetchBytes(asset.socialUrl, ctx.fetch).catch((err) => {
        throw new PlatformError("transient", `Could not read the image from storage: ${err instanceof Error ? err.message : err}`);
      });
      await expectOk(
        await send(ctx.fetch, init.value.uploadUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "image/jpeg" },
          body: new Uint8Array(buffer),
          timeoutMs: 60_000,
        }),
        "LinkedIn image upload",
        ctx.now,
        { classify }
      );
      uploaded.push({ id: init.value.image, altText: asset.alt.slice(0, 4000) });
    }

    const content =
      uploaded.length === 1
        ? { media: { id: uploaded[0].id, ...(uploaded[0].altText ? { altText: uploaded[0].altText } : {}) } }
        : uploaded.length > 1
          ? { multiImage: { images: uploaded.map((u) => ({ id: u.id, ...(u.altText ? { altText: u.altText } : {}) })) } }
          : undefined;

    const res = await send(ctx.fetch, `${REST}/posts`, {
      method: "POST",
      headers: restHeaders(c.accessToken),
      body: JSON.stringify({
        author: c.personUrn,
        commentary: escapeLittleText(text),
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        ...(content ? { content } : {}),
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
      final: true,
    });
    await expectOk(res, "LinkedIn POST /rest/posts", ctx.now, { classify, final: true });
    const urn = res.headers.get("x-restli-id") ?? "";
    return { remoteId: urn, remoteUrl: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null };
  },

  async maintain(ctx) {
    const state = ctx.state ?? (await getState(ctx.db, "linkedin"));
    const c = readCredentials<LinkedInCreds>(state);
    if (!c || !state?.tokenExpiresAt) return;
    const now = ctx.now.getTime();
    const expiresAt = state.tokenExpiresAt.getTime();
    // Refresh within the last 7 days when LinkedIn gave us a refresh token.
    if (c.refreshToken && expiresAt - now < 7 * DAY && (!c.refreshExpiresAt || c.refreshExpiresAt > now)) {
      const json = await tokenRequest(ctx, { grant_type: "refresh_token", refresh_token: c.refreshToken });
      const next = new Date(now + json.expires_in * 1000);
      await saveCredentials(
        ctx.db,
        "linkedin",
        ctx.now,
        {
          ...c,
          accessToken: json.access_token,
          refreshToken: json.refresh_token ?? c.refreshToken,
          refreshExpiresAt: json.refresh_token_expires_in ? now + json.refresh_token_expires_in * 1000 : c.refreshExpiresAt,
        },
        { tokenExpiresAt: next, refreshed: true }
      );
      return { expiresAt: next };
    }
    return { expiresAt: state.tokenExpiresAt };
  },

  oauth: {
    start({ state, redirectUri }) {
      const a = app();
      if (!a) throw new Error("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET are not set");
      const params = new URLSearchParams({
        response_type: "code",
        client_id: a.id,
        redirect_uri: redirectUri,
        state,
        scope: "openid profile w_member_social",
      });
      return { url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}` };
    },
    async finish(ctx, { code, redirectUri }) {
      const json = await tokenRequest(ctx, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
      const me = await expectJson<{ sub: string; name?: string }>(
        await send(ctx.fetch, "https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${json.access_token}` } }),
        "LinkedIn GET /v2/userinfo",
        ctx.now
      );
      const now = ctx.now.getTime();
      const c: LinkedInCreds = {
        accessToken: json.access_token,
        personUrn: `urn:li:person:${me.sub}`,
        ...(json.refresh_token
          ? {
              refreshToken: json.refresh_token,
              refreshExpiresAt: json.refresh_token_expires_in ? now + json.refresh_token_expires_in * 1000 : undefined,
            }
          : {}),
      };
      const account = me.name ?? me.sub;
      await saveCredentials(ctx.db, "linkedin", ctx.now, c, {
        account,
        tokenExpiresAt: new Date(now + json.expires_in * 1000),
        refreshed: true,
      });
      return { account };
    },
  },
};
