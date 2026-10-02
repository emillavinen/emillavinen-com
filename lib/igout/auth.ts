import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The Mac (igout) authenticates with `Authorization: Bearer <IGOUT_SYNC_SECRET>`.
 * Both sides are hashed first so the comparison is constant-time whatever
 * their lengths.
 */
export function isSyncRequest(request: Request, secret = process.env.IGOUT_SYNC_SECRET): boolean {
  if (!secret || secret.length < 24) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const given = createHash("sha256").update(header.slice("Bearer ".length)).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}
