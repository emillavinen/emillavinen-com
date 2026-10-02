import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";

/**
 * Defence in depth for DISPATCH's admin actions and routes: middleware
 * already guards /admin and /api/admin, and every mutation checks again.
 */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(ADMIN_COOKIE)?.value, process.env.ADMIN_PASSWORD);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not signed in");
}
