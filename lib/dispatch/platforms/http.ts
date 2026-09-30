import { PlatformError } from "./types";

/**
 * Shared HTTP handling for adapters: a timeout on every call, and one place
 * that turns status codes into the typed errors the runner acts on.
 */

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  /**
   * The call that makes the post public. A network failure here is
   * `ambiguous` (it may have landed), not `transient`.
   */
  final?: boolean;
}

export async function send(fetchImpl: typeof fetch, url: string, opts: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 20_000, final = false, ...init } = opts;
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (final) throw new PlatformError("ambiguous", `No response from the publish call (${reason}) — it may or may not have posted`);
    throw new PlatformError("transient", `Network error: ${reason}`);
  }
}

const DEFAULT_RATE_LIMIT_WAIT_MS = 15 * 60_000;

/** When a 429 says we may try again: Retry-After, or any of the common reset headers. */
export function rateLimitReset(headers: Headers, now: Date): Date {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return new Date(now.getTime() + seconds * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return new Date(date);
  }
  for (const name of ["x-rate-limit-reset", "x-ratelimit-reset", "ratelimit-reset"]) {
    const value = Number(headers.get(name));
    if (!Number.isFinite(value) || value <= 0) continue;
    // Epoch seconds (X, Are.na, Bluesky) — or, if small, seconds from now.
    const at = value > 1_000_000_000 ? value * 1000 : now.getTime() + value * 1000;
    if (at > now.getTime()) return new Date(at);
  }
  return new Date(now.getTime() + DEFAULT_RATE_LIMIT_WAIT_MS);
}

export interface ErrorHints {
  /** Map a non-2xx response to a specific error before the generic rules apply. */
  classify?: (status: number, body: string) => PlatformError | null;
  /** The publish call: an unreadable 2xx is then `ambiguous` rather than `transient`. */
  final?: boolean;
}

/** Throws the typed error for a non-2xx response; returns the body text for a 2xx one. */
export async function expectOk(res: Response, what: string, now: Date, hints: ErrorHints = {}): Promise<string> {
  const body = await res.text().catch(() => "");
  if (res.ok) return body;
  const snippet = body.slice(0, 600);
  const detail = `${what} → ${res.status}${snippet ? `: ${snippet}` : ""}`;
  const specific = hints.classify?.(res.status, body);
  if (specific) throw specific;
  if (res.status === 429) throw new PlatformError("rate_limited", detail, { retryAt: rateLimitReset(res.headers, now), status: 429 });
  if (res.status === 401 || res.status === 403) throw new PlatformError("auth", detail, { status: res.status });
  if (res.status === 402) throw new PlatformError("credits", detail, { status: 402 });
  if (res.status >= 500 || res.status === 408) throw new PlatformError("transient", detail, { status: res.status });
  throw new PlatformError("rejected", detail, { status: res.status });
}

export async function expectJson<T>(res: Response, what: string, now: Date, hints: ErrorHints = {}): Promise<T> {
  const body = await expectOk(res, what, now, hints);
  try {
    return JSON.parse(body) as T;
  } catch {
    // A 2xx we cannot read: the call went through, so a publish is not retried.
    throw new PlatformError(hints.final ? "ambiguous" : "transient", `${what} returned an unreadable response`);
  }
}
