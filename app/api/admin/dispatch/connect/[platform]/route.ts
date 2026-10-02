import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dispatch/admin";
import { isPlatform, siteUrl } from "@/lib/dispatch/config";
import { canEncrypt, randomToken, signValue } from "@/lib/dispatch/crypto";
import { oauthSecret } from "@/lib/dispatch/next";
import { ADAPTERS } from "@/lib/dispatch/platforms";

// Starts an OAuth connect flow (X, Threads, LinkedIn). The state — and the
// PKCE verifier where the platform supports it — travels in a signed,
// short-lived, httpOnly cookie scoped to the callback path. SameSite=Lax so
// the browser sends it on the platform's redirect back.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "dispatch_oauth";

function back(message: string) {
  return NextResponse.redirect(`${siteUrl()}/admin/connections?error=${encodeURIComponent(message)}`);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { platform } = await params;
  if (!isPlatform(platform) || !ADAPTERS[platform].oauth) return back("That platform has no connect flow.");
  const secret = oauthSecret();
  if (!secret) return back("ADMIN_PASSWORD is not set.");
  if (!canEncrypt()) return back("Set DISPATCH_ENCRYPTION_KEY before connecting a platform.");

  const state = randomToken(24);
  const redirectUri = `${siteUrl()}/api/auth/${platform}/callback`;
  let start;
  try {
    start = ADAPTERS[platform].oauth!.start({ state, redirectUri });
  } catch (err) {
    return back(err instanceof Error ? err.message : "Could not start the connect flow.");
  }
  const response = NextResponse.redirect(start.url);
  response.cookies.set(OAUTH_COOKIE, signValue(secret, { platform, state, verifier: start.verifier }, 10 * 60_000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/auth",
  });
  return response;
}
