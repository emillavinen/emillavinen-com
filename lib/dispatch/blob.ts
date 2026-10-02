import { env } from "./config";

/**
 * Image storage. Vercel Blob (public store) in production, swapped for an
 * in-memory store in tests. @vercel/blob is imported lazily so nothing loads
 * it until an image is actually written.
 */
export interface BlobStore {
  put(pathname: string, body: Buffer, contentType: string): Promise<string>;
  del(urls: string[]): Promise<void>;
}

export function isBlobConfigured(): boolean {
  return Boolean(env("BLOB_READ_WRITE_TOKEN"));
}

/** BLOB_READ_WRITE_TOKEN=local (development only) writes into public/dispatch-local. */
export function isLocalBlob(): boolean {
  return env("BLOB_READ_WRITE_TOKEN") === "local" && process.env.NODE_ENV !== "production";
}

export function blobStore(): BlobStore {
  return isLocalBlob() ? localBlobStore() : vercelBlobStore();
}

function localBlobStore(): BlobStore {
  return {
    async put(pathname, body) {
      const [{ mkdir, writeFile }, path, { randomBytes }] = await Promise.all([import("node:fs/promises"), import("node:path"), import("node:crypto")]);
      const name = pathname.replace(/(\.[a-z0-9]+)$/i, `-${randomBytes(4).toString("hex")}$1`);
      const file = path.join(process.cwd(), "public", "dispatch-local", name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      return `/dispatch-local/${name}`;
    },
    async del(urls) {
      const [{ rm }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
      for (const url of urls) {
        if (url.startsWith("/dispatch-local/")) await rm(path.join(process.cwd(), "public", url), { force: true });
      }
    },
  };
}

export function vercelBlobStore(): BlobStore {
  return {
    async put(pathname, body, contentType) {
      const { put } = await import("@vercel/blob");
      const result = await put(pathname, body, {
        access: "public",
        contentType,
        addRandomSuffix: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      return result.url;
    },
    async del(urls) {
      if (urls.length === 0) return;
      const { del } = await import("@vercel/blob");
      await del(urls);
    },
  };
}

/** Downloads a URL into memory, with a timeout and a size ceiling. */
export async function fetchBytes(
  url: string,
  fetchImpl: typeof fetch = fetch,
  { timeoutMs = 20_000, maxBytes = 60 * 1024 * 1024 } = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new Error(`GET ${url} is too large (${length} bytes)`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error(`GET ${url} is too large (${buffer.length} bytes)`);
  return { buffer, contentType: res.headers.get("content-type") ?? "" };
}
