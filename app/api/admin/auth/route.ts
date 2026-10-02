import * as OTPAuth from "otpauth";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createSessionToken, SESSION_TTL_MS } from "@/lib/admin-session";
import { clientIp, isLoginBlocked, recordLoginFailure } from "@/lib/login-rate-limit";

async function signedIn(password: string) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await createSessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { password, totp } = body as { password?: string; totp?: string };

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not configured" }, { status: 500 });
  }

  const ip = clientIp(request.headers);
  if (await isLoginBlocked(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    await recordLoginFailure(ip);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  if (!process.env.TOTP_SECRET) {
    return signedIn(password);
  }

  if (!totp) {
    return NextResponse.json({ step: "totp" });
  }

  const totpObj = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(process.env.TOTP_SECRET),
  });

  const delta = totpObj.validate({ token: totp, window: 1 });
  if (delta === null) {
    await recordLoginFailure(ip);
    return NextResponse.json({ error: "Incorrect authenticator code." }, { status: 401 });
  }

  return signedIn(password);
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return response;
}
