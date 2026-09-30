/**
 * DISPATCH configuration. Everything is read from the environment at call
 * time, never at module load, so the site builds and runs with none of it
 * set and tests can change it freely. A missing value switches the feature
 * that needs it off; see `logOnce` for the single log line that says so.
 */

export const PLATFORMS = ["arena", "x", "threads", "linkedin", "bluesky", "tumblr"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  arena: "Are.na",
  x: "X",
  threads: "Threads",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
  tumblr: "Tumblr",
};

export const DEFAULT_CAPS: Record<Platform, number> = {
  x: 3,
  threads: 3,
  linkedin: 1,
  bluesky: 3,
  tumblr: 3,
  arena: 10,
};

export const TIMEZONE = "Europe/Helsinki";

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

export function env(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

export function envBool(name: string, fallback: boolean): boolean {
  const value = env(name)?.toLowerCase();
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

export function envInt(name: string, fallback: number): number {
  const value = env(name);
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function capFor(platform: Platform): number {
  return Math.max(0, envInt(`CAP_${platform.toUpperCase()}`, DEFAULT_CAPS[platform]));
}

/** The public origin DISPATCH links to and registers OAuth callbacks on. */
export function siteUrl(): string {
  return (env("DISPATCH_SITE_URL") ?? "https://emillavinen.com").replace(/\/+$/, "");
}

export function pinterestBoards(): string[] {
  return (env("PINTEREST_BOARDS") ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

const logged = new Set<string>();

/** Logs a line once per process — used for "feature off" notices. */
export function logOnce(key: string, message: string): void {
  if (logged.has(key)) return;
  logged.add(key);
  console.info(`[dispatch] ${message}`);
}
