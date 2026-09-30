import { PLATFORMS, type Platform } from "../config";
import { arena } from "./arena";
import { bluesky } from "./bluesky";
import { linkedin } from "./linkedin";
import { threads } from "./threads";
import { tumblr } from "./tumblr";
import type { Adapter } from "./types";
import { x } from "./x";

export const ADAPTERS: Record<Platform, Adapter> = { arena, x, threads, linkedin, bluesky, tumblr };

export function adapterFor(platform: Platform): Adapter {
  return ADAPTERS[platform];
}

export function allAdapters(): Adapter[] {
  return PLATFORMS.map((p) => ADAPTERS[p]);
}
