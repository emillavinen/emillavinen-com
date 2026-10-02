import { env } from "../config";
import { fetchBytes } from "../blob";
import { clean } from "./format";
import { expectJson, send } from "./http";
import { oauth1Header, type OAuth1Keys } from "./oauth1";
import { PlatformError, type Adapter } from "./types";

/**
 * Tumblr, Neue Post Format (https://github.com/tumblr/docs, checked
 * 2026-09-30): `POST /v2/blog/{blog}/posts` as multipart — a `json` part
 * holding the NPF content, then one part per image referenced by
 * `identifier`. OAuth 1.0a; multipart bodies are not part of the signature.
 */

const API = "https://api.tumblr.com/v2";

function keys(): OAuth1Keys | null {
  const consumerKey = env("TUMBLR_CONSUMER_KEY");
  const consumerSecret = env("TUMBLR_CONSUMER_SECRET");
  const token = env("TUMBLR_TOKEN");
  const tokenSecret = env("TUMBLR_TOKEN_SECRET");
  return consumerKey && consumerSecret && token && tokenSecret ? { consumerKey, consumerSecret, token, tokenSecret } : null;
}

function blog(): string {
  const b = env("TUMBLR_BLOG")!;
  return b.includes(".") ? b : `${b}.tumblr.com`;
}

export const tumblr: Adapter = {
  platform: "tumblr",
  maxImages: 10,

  missingEnv() {
    return ["TUMBLR_CONSUMER_KEY", "TUMBLR_CONSUMER_SECRET", "TUMBLR_TOKEN", "TUMBLR_TOKEN_SECRET", "TUMBLR_BLOG"].filter((n) => !env(n));
  },

  configured() {
    return tumblr.missingEnv().length === 0;
  },

  /** The caption shown under the images. The title and link are separate NPF blocks. */
  format(work) {
    return clean(work.caption);
  },

  async check(ctx) {
    const k = keys()!;
    const url = `${API}/user/info`;
    const json = await expectJson<{ response: { user: { name: string } } }>(
      await send(ctx.fetch, url, { headers: { Authorization: oauth1Header("GET", url, k) } }),
      "Tumblr GET /v2/user/info",
      ctx.now
    );
    return { account: json.response.user.name, detail: `posting to ${blog()}` };
  },

  async post(ctx, { work, assets, text, link }) {
    const k = keys()!;
    const form = new FormData();
    const content: Record<string, unknown>[] = [];
    for (const [i, asset] of assets.slice(0, tumblr.maxImages).entries()) {
      const { buffer } = await fetchBytes(asset.socialUrl, ctx.fetch).catch((err) => {
        throw new PlatformError("transient", `Could not read the image from storage: ${err instanceof Error ? err.message : err}`);
      });
      const identifier = `image-${i}`;
      content.push({
        type: "image",
        media: [{ type: "image/jpeg", identifier, width: asset.width, height: asset.height }],
        ...(asset.alt ? { alt_text: asset.alt } : {}),
      });
      form.append(identifier, new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), `${identifier}.jpg`);
    }
    const title = clean(work.title);
    if (title) content.push({ type: "text", subtype: "heading1", text: title });
    if (text) content.push({ type: "text", text });
    content.push({ type: "text", text: link, formatting: [{ start: 0, end: link.length, type: "link", url: link }] });
    const json = {
      content,
      state: "published",
      ...(work.tags.length > 0 ? { tags: work.tags.map((t) => t.replace(/,/g, " ")).join(",") } : {}),
    };
    // The JSON part must come first.
    const body = new FormData();
    body.append("json", new Blob([JSON.stringify(json)], { type: "application/json" }));
    form.forEach((value, key) => body.append(key, value));

    const url = `${API}/blog/${blog()}/posts`;
    const res = await send(ctx.fetch, url, {
      method: "POST",
      headers: { Authorization: oauth1Header("POST", url, k) },
      body,
      final: true,
      timeoutMs: 60_000,
    });
    const out = await expectJson<{ response: { id: string | number; id_string?: string } }>(res, "Tumblr POST /posts", ctx.now, { final: true });
    const id = out.response.id_string ?? String(out.response.id);
    return { remoteId: id, remoteUrl: `https://www.tumblr.com/${blog().replace(/\.tumblr\.com$/, "")}/${id}` };
  },
};
