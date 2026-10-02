import { NextRequest, NextResponse } from "next/server";
import { hasCronSecret, serverDeps } from "@/lib/dispatch/next";
import { runDispatch, type Trigger } from "@/lib/dispatch/runner";

// The DISPATCH runner. Called hourly by .github/workflows/dispatch.yml
// (?trigger=github) and once a day by Vercel Cron as the backup. Requires
// `Authorization: Bearer ${CRON_SECRET}`. Idempotent: safe to call often
// and safe when two calls overlap.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function triggerOf(request: NextRequest): Trigger {
  if (request.nextUrl.searchParams.get("trigger") === "github") return "github";
  if ((request.headers.get("user-agent") ?? "").toLowerCase().includes("vercel-cron")) return "vercel-cron";
  return "manual";
}

async function handle(request: NextRequest) {
  if (!hasCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deps = await serverDeps();
  if (!deps) {
    return NextResponse.json({ skipped: "DATABASE_URL is not set — DISPATCH is off." });
  }
  const trigger = triggerOf(request);
  try {
    const report = await runDispatch(deps, trigger);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[dispatch] run failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
