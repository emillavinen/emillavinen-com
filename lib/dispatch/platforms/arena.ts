import { env } from "../config";
import { clean, fitBlocks, joinPresent } from "./format";
import { expectJson, send } from "./http";
import { PlatformError, type Adapter, type PostResult } from "./types";

/**
 * Are.na, API v3 (https://api.are.na/v3/openapi.json, checked 2026-09-30).
 * Each image becomes an Image block made from its `social` Blob URL
 * (`POST /v3/blocks` with `value` = the URL), connected to ARENA_CHANNEL,
 * titled with the work's title and described with the caption and link.
 */

const API = "https://api.are.na/v3";

function token(): string {
  const t = env("ARENA_TOKEN");
  if (!t) throw new PlatformError("auth", "ARENA_TOKEN is not set");
  return t;
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", Accept: "application/json" };
}

export const arena: Adapter = {
  platform: "arena",
  maxImages: 10,

  missingEnv() {
    return ["ARENA_TOKEN", "ARENA_CHANNEL"].filter((name) => !env(name));
  },

  configured() {
    return arena.missingEnv().length === 0;
  },

  format(work, link) {
    // Are.na descriptions are markdown; the title goes in the block's own title.
    return fitBlocks({ head: clean(work.caption), tail: link }, 4000);
  },

  async check(ctx) {
    const me = await expectJson<{ slug: string; name?: string }>(
      await send(ctx.fetch, `${API}/me`, { headers: headers() }),
      "Are.na GET /v3/me",
      ctx.now
    );
    const channelId = env("ARENA_CHANNEL")!;
    const channel = await expectJson<{ slug: string; title: string; visibility?: string; abilities?: { add_to?: boolean } }>(
      await send(ctx.fetch, `${API}/channels/${encodeURIComponent(channelId)}`, { headers: headers() }),
      `Are.na GET /v3/channels/${channelId}`,
      ctx.now,
      { classify: (status) => (status === 404 ? new PlatformError("auth", `Are.na channel "${channelId}" not found — check ARENA_CHANNEL`) : null) }
    );
    if (channel.abilities && channel.abilities.add_to === false) {
      throw new PlatformError("auth", `This Are.na token cannot add blocks to "${channel.slug}"`);
    }
    return {
      account: me.slug,
      detail: joinPresent([`channel ${channel.slug}`, channel.visibility === "private" ? "private channel" : null], " · "),
    };
  },

  async post(ctx, { work, assets, text }) {
    const channelId = env("ARENA_CHANNEL")!;
    const created: string[] = [];
    const images = assets.slice(0, arena.maxImages);
    for (const [index, asset] of images.entries()) {
      const title = images.length > 1 ? `${work.title} (${index + 1}/${images.length})` : work.title;
      try {
        const block = await expectJson<{ id: number | string }>(
          await send(ctx.fetch, `${API}/blocks`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
              value: asset.socialUrl,
              title,
              description: text,
              ...(asset.alt ? { alt_text: asset.alt } : {}),
              channel_ids: [channelId],
            }),
            final: true,
          }),
          "Are.na POST /v3/blocks",
          ctx.now,
          { final: true }
        );
        created.push(String(block.id));
      } catch (err) {
        // Blocks already made stay made: report what landed rather than
        // retrying and duplicating them.
        if (created.length > 0) break;
        throw err;
      }
    }
    const result: PostResult = {
      remoteId: created.join(","),
      remoteUrl: `https://www.are.na/block/${created[0]}`,
    };
    if (created.length < images.length) result.note = `${created.length} of ${images.length} images added`;
    return result;
  },
};
