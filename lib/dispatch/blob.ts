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
