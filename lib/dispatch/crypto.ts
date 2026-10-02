import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./config";

/**
 * Credentials at rest are AES-256-GCM encrypted with DISPATCH_ENCRYPTION_KEY.
 * The key may be any string; it is hashed to 32 bytes, so `openssl rand
 * -base64 32` output works as is. Format: v1.<iv>.<tag>.<ciphertext>, base64url.
 */

function key(): Buffer | null {
  const raw = env("DISPATCH_ENCRYPTION_KEY");
  return raw ? createHash("sha256").update(raw).digest() : null;
}

export function canEncrypt(): boolean {
  return key() !== null;
}

export function encryptJson(value: unknown): string {
  const k = key();
  if (!k) throw new Error("DISPATCH_ENCRYPTION_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function decryptJson<T>(payload: string): T {
  const k = key();
  if (!k) throw new Error("DISPATCH_ENCRYPTION_KEY is not set");
  const [version, iv, tag, body] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Unreadable credentials payload");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const text = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(text) as T;
}

/** HMAC-signed, expiring value for short-lived cookies such as OAuth state. */
export function signValue(secret: string, value: unknown, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ v: value, exp: now + ttlMs })).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifySignedValue<T>(secret: string, token: string | undefined, now = Date.now()): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { v: T; exp: number };
    return parsed.exp > now ? parsed.v : null;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256Base64Url(data: string): string {
  return createHash("sha256").update(data).digest("base64url");
}
