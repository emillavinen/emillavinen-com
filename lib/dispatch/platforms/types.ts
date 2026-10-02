import type { Platform } from "../config";
import type { Db } from "../db/client";
import type { Asset, PlatformStateRow, Work } from "../db/schema";

/**
 * How a platform call failed, which decides what the runner does next:
 * - transient: 5xx or network trouble before the final call — retry with backoff
 * - rate_limited: 429 — reschedule at the reset time, not counted as an attempt
 * - auth / credits: needs Emil — fail, pause the platform, alert once
 * - rejected: the platform refused this work (too long, bad media) — fail, no retry
 * - ambiguous: the final publish call may or may not have landed — mark `unknown`,
 *   never retry, because a duplicate post is worse than a missed one
 */
export type PlatformErrorKind = "transient" | "rate_limited" | "auth" | "credits" | "rejected" | "ambiguous";

export class PlatformError extends Error {
  readonly kind: PlatformErrorKind;
  readonly retryAt?: Date;
  readonly status?: number;
  constructor(kind: PlatformErrorKind, message: string, opts: { retryAt?: Date; status?: number } = {}) {
    super(message);
    this.name = "PlatformError";
    this.kind = kind;
    this.retryAt = opts.retryAt;
    this.status = opts.status;
  }
}

export interface AdapterContext {
  db: Db;
  now: Date;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  /** Wall-clock (Date.now) moment after which an adapter should stop waiting on the platform. */
  deadline: number;
  state?: PlatformStateRow;
}

export interface PostPayload {
  work: Work;
  assets: Asset[];
  text: string;
  link: string;
}

export interface PostResult {
  remoteId: string;
  remoteUrl: string | null;
  /** Something Emil should know even though it posted (e.g. only some images made it). */
  note?: string;
}

export interface CheckResult {
  account: string;
  detail?: string;
}

export interface OAuthStart {
  url: string;
  /** Saved in the signed state cookie and handed back to `finish`. */
  verifier?: string;
}

export interface OAuthProvider {
  start(input: { state: string; redirectUri: string }): OAuthStart;
  finish(ctx: AdapterContext, input: { code: string; redirectUri: string; verifier?: string }): Promise<CheckResult>;
}

export interface Adapter {
  platform: Platform;
  /** Most images one post can carry; extra images are left off. */
  maxImages: number;
  /** Environment variables this platform needs; empty when it has what it needs from env. */
  missingEnv(): string[];
  /** True when env and stored credentials are enough to post. */
  configured(state: PlatformStateRow | undefined): boolean;
  /** A cheap authenticated call that never posts. */
  check(ctx: AdapterContext): Promise<CheckResult>;
  post(ctx: AdapterContext, payload: PostPayload): Promise<PostResult>;
  format(work: Pick<Work, "title" | "caption" | "client" | "tools" | "tags" | "year">, link: string): string;
  oauth?: OAuthProvider;
  /** Housekeeping on every run: token refresh and expiry warnings. Returns a warning to alert on, if any. */
  maintain?(ctx: AdapterContext): Promise<{ expiresAt?: Date | null } | void>;
}
