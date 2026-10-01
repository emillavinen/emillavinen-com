import path from "node:path";
import type { BlobStore } from "@/lib/dispatch/blob";
import type { Db } from "@/lib/dispatch/db/client";
import * as schema from "@/lib/dispatch/db/schema";
import type { Notifier } from "@/lib/dispatch/notify";

/**
 * A fresh Postgres (PGlite, in-process) with DISPATCH's committed migrations
 * applied — the same SQL production runs.
 */
export async function testDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  return db as unknown as Db;
}

export function memoryBlob(): BlobStore & { files: Map<string, { body: Buffer; contentType: string }> } {
  const files = new Map<string, { body: Buffer; contentType: string }>();
  let n = 0;
  return {
    files,
    async put(pathname, body, contentType) {
      const url = `https://blob.test/${pathname.replace(/(\.[a-z]+)$/, `-${++n}$1`)}`;
      files.set(url, { body, contentType });
      return url;
    },
    async del(urls) {
      for (const u of urls) files.delete(u);
    },
  };
}

export function fakeNotifier(): Notifier & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    async send(text) {
      messages.push(text);
      return true;
    },
  };
}

/** Deterministic pseudo-random numbers (mulberry32). */
export function seededRand(seed = 42): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function sampleJpeg(width = 1200, height = 1500, color = "#c03030"): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width, height, channels: 3, background: color } }).jpeg({ quality: 90 }).toBuffer();
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** A fetch that routes by URL prefix and records every call. */
export function routeFetch(routes: [string | RegExp, Handler][]): typeof fetch & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (input instanceof Request && !init) {
      // Some clients (atproto) pass a Request; record it like (url, init).
      const body = input.method === "GET" || input.method === "HEAD" ? undefined : await input.clone().text();
      init = { method: input.method, headers: Object.fromEntries(input.headers.entries()), body };
    }
    calls.push({ url, init });
    for (const [match, handler] of routes) {
      if (typeof match === "string" ? url.startsWith(match) : match.test(url)) return handler(url, init);
    }
    return new Response(`no route for ${url}`, { status: 599 });
  }) as typeof fetch & { calls: { url: string; init?: RequestInit }[] };
  fn.calls = calls;
  return fn;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

/** Env vars for a test, restored afterwards. */
export function withEnv(vars: Record<string, string | undefined>): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

/** Every env var DISPATCH reads, cleared, so a developer's shell never leaks into a test. */
export const DISPATCH_ENV_KEYS = [
  "DATABASE_URL",
  "BLOB_READ_WRITE_TOKEN",
  "DISPATCH_ENABLED",
  "DRY_RUN",
  "DISPATCH_ENCRYPTION_KEY",
  "POSTING_WINDOW",
  "BACKLOG_DRIP_PER_DAY",
  "PINTEREST_BOARDS",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "RESEND_API_KEY",
  "NOTIFY_EMAIL",
  "ARENA_TOKEN",
  "ARENA_CHANNEL",
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_TOKEN_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "X_OAUTH2_REFRESH_TOKEN",
  "X_INCLUDE_LINK",
  "THREADS_APP_ID",
  "THREADS_APP_SECRET",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_VERSION",
  "BSKY_HANDLE",
  "BSKY_APP_PASSWORD",
  "TUMBLR_CONSUMER_KEY",
  "TUMBLR_CONSUMER_SECRET",
  "TUMBLR_TOKEN",
  "TUMBLR_TOKEN_SECRET",
  "TUMBLR_BLOG",
  "CAP_X",
  "CAP_ARENA",
  "DISPATCH_SITE_URL",
];

export function cleanEnv(extra: Record<string, string> = {}): () => void {
  return withEnv({ ...Object.fromEntries(DISPATCH_ENV_KEYS.map((k) => [k, undefined])), ...extra });
}
