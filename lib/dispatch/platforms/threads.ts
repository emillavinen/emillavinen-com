import { env } from "../config";
import { canEncrypt } from "../crypto";
import { readCredentials, saveCredentials, getState } from "../credentials";
import { fitBlocks } from "./format";
import { expectJson, send } from "./http";
import { PlatformError, type Adapter, type AdapterContext } from "./types";

/**
 * Threads (https://developers.facebook.com/docs/threads, checked 2026-09-30).
 * Create an IMAGE container from the `social` URL (a CAROUSEL of item
 * containers for several images), poll its status until FINISHED, then
 * publish. Long-lived tokens last 60 days; they are refreshed once they are
 * over 24 hours old, which keeps them from ever expiring while DISPATCH runs.
 */

const GRAPH = "https://graph.threads.net";
const API = `${GRAPH}/v1.0`;
const DAY = 86_400_000;

interface ThreadsCreds {
  accessToken: string;
  userId: string;
}

function app(): { id: string; secret: string } | null {
  const id = env("THREADS_APP_ID");
  const secret = env("THREADS_APP_SECRET");
  return id && secret ? { id, secret } : null;
}

/** Meta Graph errors carry a code in the body; map the ones that need Emil. */
function classify(status: number, body: string): PlatformError | null {
  let code: number | undefined;
  let message = body.slice(0, 200);
  try {
    const parsed = JSON.parse(body) as { error?: { code?: number; message?: string } };
    code = parsed.error?.code;
    message = parsed.error?.message ?? message;
  } catch {
    /* not JSON */
  }
  if (code === 190 || code === 102) return new PlatformError("auth", `Threads token is no longer valid (${message}) — reconnect in /admin/connections`, { status });
  if (code === 10 || code === 200) return new PlatformError("auth", `Threads permission missing (${message})`, { status });
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return new PlatformError("rate_limited", `Threads rate limit (${message})`, { status, retryAt: undefined });
  }
  return null;
}

function creds(ctx: AdapterContext): ThreadsCreds {
  const c = readCredentials<ThreadsCreds>(ctx.state);
  if (!c) throw new PlatformError("auth", "Threads is not connected — connect it in /admin/connections");
  return c;
}

async function createContainer(ctx: AdapterContext, c: ThreadsCreds, params: Record<string, string>): Promise<string> {
  const res = await send(ctx.fetch, `${API}/${c.userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: c.accessToken }).toString(),
  });
  const json = await expectJson<{ id: string }>(res, "Threads POST /threads", ctx.now, { classify });
  return json.id;
}

async function waitFinished(ctx: AdapterContext, c: ThreadsCreds, id: string): Promise<void> {
  for (let i = 0; ; i++) {
    const url = `${API}/${id}?fields=status,error_message&access_token=${encodeURIComponent(c.accessToken)}`;
    const json = await expectJson<{ status?: string; error_message?: string }>(
      await send(ctx.fetch, url),
      "Threads GET container status",
      ctx.now,
      { classify }
    );
    if (json.status === "FINISHED" || json.status === "PUBLISHED") return;
    if (json.status === "ERROR" || json.status === "EXPIRED") {
      throw new PlatformError("rejected", `Threads could not process the media: ${json.error_message ?? json.status}`);
    }
    if (Date.now() + 3_000 > ctx.deadline) throw new PlatformError("transient", "Threads media still processing at the end of the run");
    await ctx.sleep(Math.min(2_000 + i * 1_000, 5_000));
  }
}

/** Threads counts characters, but emoji by their UTF-8 bytes. Count conservatively. */
export function threadsLength(text: string): number {
  let n = 0;
  for (const ch of text) n += /\p{Extended_Pictographic}/u.test(ch) ? Buffer.byteLength(ch, "utf8") : 1;
  return n;
}

export const threads: Adapter = {
  platform: "threads",
  maxImages: 20,

  missingEnv() {
    return ["THREADS_APP_ID", "THREADS_APP_SECRET", "DISPATCH_ENCRYPTION_KEY"].filter((n) => !env(n));
  },

  configured(state) {
    return Boolean(app() && canEncrypt() && state?.credentials);
  },

  format(work, link) {
    return fitBlocks({ head: work.title, body: work.caption, tail: link }, 500, threadsLength);
  },

  async check(ctx) {
    const c = creds(ctx);
    const me = await expectJson<{ id: string; username?: string }>(
      await send(ctx.fetch, `${API}/me?fields=id,username&access_token=${encodeURIComponent(c.accessToken)}`),
      "Threads GET /me",
      ctx.now,
      { classify }
    );
    return { account: me.username ? `@${me.username}` : me.id };
  },

  async post(ctx, { assets, text }) {
    const c = creds(ctx);
    const images = assets.slice(0, threads.maxImages);
    if (images.length === 0) throw new PlatformError("rejected", "Nothing to post: the work has no images");
    let containerId: string;
    if (images.length === 1) {
      containerId = await createContainer(ctx, c, { media_type: "IMAGE", image_url: images[0].socialUrl, text });
    } else {
      const children: string[] = [];
      for (const asset of images) {
        children.push(
          await createContainer(ctx, c, {
            media_type: "IMAGE",
            image_url: asset.socialUrl,
            is_carousel_item: "true",
            ...(asset.alt ? { alt_text: asset.alt } : {}),
          })
        );
      }
      for (const child of children) await waitFinished(ctx, c, child);
      containerId = await createContainer(ctx, c, { media_type: "CAROUSEL", children: children.join(","), text });
    }
    await waitFinished(ctx, c, containerId);

    const res = await send(ctx.fetch, `${API}/${c.userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: containerId, access_token: c.accessToken }).toString(),
      final: true,
    });
    const published = await expectJson<{ id: string }>(res, "Threads POST /threads_publish", ctx.now, { classify, final: true });

    let permalink: string | null = null;
    try {
      const info = await expectJson<{ permalink?: string }>(
        await send(ctx.fetch, `${API}/${published.id}?fields=permalink&access_token=${encodeURIComponent(c.accessToken)}`),
        "Threads GET permalink",
        ctx.now
      );
      permalink = info.permalink ?? null;
    } catch {
      /* the post exists; the link is a nicety */
    }
    return { remoteId: published.id, remoteUrl: permalink };
  },

  async maintain(ctx) {
    const state = ctx.state ?? (await getState(ctx.db, "threads"));
    const c = readCredentials<ThreadsCreds>(state);
    if (!c || !state) return;
    const expiresAt = state.tokenExpiresAt?.getTime() ?? 0;
    const refreshedAt = state.tokenRefreshedAt?.getTime() ?? 0;
    const now = ctx.now.getTime();
    if (expiresAt && expiresAt <= now) return { expiresAt: state.tokenExpiresAt };
    if (now - refreshedAt < DAY) return { expiresAt: state.tokenExpiresAt };
    const url = `${GRAPH}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(c.accessToken)}`;
    const json = await expectJson<{ access_token: string; expires_in?: number }>(await send(ctx.fetch, url), "Threads refresh token", ctx.now, { classify });
    const next = new Date(now + (json.expires_in ?? 60 * 86_400) * 1000);
    await saveCredentials(ctx.db, "threads", ctx.now, { ...c, accessToken: json.access_token }, { tokenExpiresAt: next, refreshed: true });
    return { expiresAt: next };
  },

  oauth: {
    start({ state, redirectUri }) {
      const a = app();
      if (!a) throw new Error("THREADS_APP_ID / THREADS_APP_SECRET are not set");
      const params = new URLSearchParams({
        client_id: a.id,
        redirect_uri: redirectUri,
        scope: "threads_basic,threads_content_publish",
        response_type: "code",
        state,
      });
      return { url: `https://threads.net/oauth/authorize?${params.toString()}` };
    },
    async finish(ctx, { code, redirectUri }) {
      const a = app();
      if (!a) throw new PlatformError("auth", "THREADS_APP_ID / THREADS_APP_SECRET are not set");
      const short = await expectJson<{ access_token: string; user_id: string | number }>(
        await send(ctx.fetch, `${GRAPH}/oauth/access_token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: a.id,
            client_secret: a.secret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }).toString(),
        }),
        "Threads code exchange",
        ctx.now,
        { classify }
      );
      const long = await expectJson<{ access_token: string; expires_in?: number }>(
        await send(
          ctx.fetch,
          `${GRAPH}/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(a.secret)}&access_token=${encodeURIComponent(short.access_token)}`
        ),
        "Threads long-lived token",
        ctx.now,
        { classify }
      );
      const c: ThreadsCreds = { accessToken: long.access_token, userId: String(short.user_id) };
      const me = await expectJson<{ username?: string }>(
        await send(ctx.fetch, `${API}/me?fields=id,username&access_token=${encodeURIComponent(c.accessToken)}`),
        "Threads GET /me",
        ctx.now,
        { classify }
      );
      const account = me.username ? `@${me.username}` : c.userId;
      await saveCredentials(ctx.db, "threads", ctx.now, c, {
        account,
        tokenExpiresAt: new Date(ctx.now.getTime() + (long.expires_in ?? 60 * 86_400) * 1000),
        refreshed: true,
      });
      return { account };
    },
  },
};
