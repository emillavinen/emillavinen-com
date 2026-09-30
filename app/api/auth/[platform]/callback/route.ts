import { NextRequest, NextResponse } from "next/server";
import { isPlatform, siteUrl, type Platform } from "@/lib/dispatch/config";
import { getState, setStatus } from "@/lib/dispatch/credentials";
import { verifySignedValue } from "@/lib/dispatch/crypto";
import { oauthSecret, serverDeps } from "@/lib/dispatch/next";
import { resolveAlert } from "@/lib/dispatch/notify";
import { ADAPTERS } from "@/lib/dispatch/platforms";
import { enablePlatform } from "@/lib/dispatch/runner";
import { logEvent } from "@/lib/dispatch/store";

// OAuth callbacks registered with the platforms:
//   https://emillavinen.com/api/auth/x/callback
//   https://emillavinen.com/api/auth/threads/callback
//   https://emillavinen.com/api/auth/linkedin/callback
// The request is trusted only if its `state` matches the signed cookie set
// when the admin started the flow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "dispatch_oauth";

interface OAuthCookie {
  platform: Platform;
  state: string;
  verifier?: string;
}

function back(params: Record<string, string>) {
  const response = NextResponse.redirect(`${siteUrl()}/admin/connections?${new URLSearchParams(params).toString()}`);
  response.cookies.set(OAUTH_COOKIE, "", { maxAge: 0, path: "/api/auth" });
  return response;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isPlatform(platform) || !ADAPTERS[platform].oauth) return back({ error: "Unknown platform." });
  const q = request.nextUrl.searchParams;
  if (q.get("error")) return back({ error: `${platform}: ${q.get("error_description") ?? q.get("error")}` });

  const secret = oauthSecret();
  const saved = secret ? verifySignedValue<OAuthCookie>(secret, request.cookies.get(OAUTH_COOKIE)?.value) : null;
  const code = q.get("code");
  if (!saved || saved.platform !== platform || !code || q.get("state") !== saved.state) {
    return back({ error: "The connect link expired or did not match. Start again from this page (on emillavinen.com)." });
  }

  const deps = await serverDeps();
  if (!deps) return back({ error: "DATABASE_URL is not set." });
  try {
    const before = await getState(deps.db, platform);
    const result = await ADAPTERS[platform].oauth!.finish(
      { db: deps.db, now: deps.now, fetch: deps.fetch, sleep: deps.sleep, deadline: Date.now() + 30_000, state: before },
      { code, redirectUri: `${siteUrl()}/api/auth/${platform}/callback`, verifier: saved.verifier }
    );
    if (!before || before.status === "disabled") {
      await enablePlatform(deps.db, platform, deps.now);
    } else {
      await setStatus(deps.db, platform, deps.now, "ok", null, { ok: true, checked: true });
      await resolveAlert({ db: deps.db, now: deps.now, notifier: deps.notifier }, `platform:${platform}`, `${platform} reconnected — its queue resumes.`);
    }
    await logEvent(deps.db, deps.now, { type: "platform_connected", platform, message: result.account });
    return back({ connected: platform });
  } catch (err) {
    console.error(`[dispatch] ${platform} connect failed`, err);
    return back({ error: `${platform}: ${err instanceof Error ? err.message : "connect failed"}` });
  }
}
