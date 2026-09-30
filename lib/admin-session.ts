/**
 * The admin session cookie: `v2.<expiry ms>.<HMAC-SHA256 signature>`, keyed
 * from ADMIN_PASSWORD so changing the password signs everyone out. Uses only
 * WebCrypto, so the same code verifies in middleware (edge) and in Node
 * route handlers and server actions.
 */

export const ADMIN_COOKIE = "admin_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(password: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${password}|admin-session-v2`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(password: string, now = Date.now()): Promise<string> {
  const exp = now + SESSION_TTL_MS;
  return `v2.${exp}.${await hmac(password, `admin:${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined, password: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token || !password) return false;
  const [version, expRaw, signature] = token.split(".");
  if (version !== "v2" || !expRaw || !signature) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false;
  return constantTimeEqual(signature, await hmac(password, `admin:${exp}`));
}
