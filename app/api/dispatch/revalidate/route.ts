import { NextRequest, NextResponse } from "next/server";
import { hasCronSecret, revalidatePaths } from "@/lib/dispatch/next";
import { workPaths } from "@/lib/dispatch/works";

// Refreshes the portfolio pages after writes made outside the site (the
// local backlog import calls this). Same bearer secret as the runner.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { slugs?: unknown };
  const slugs = Array.isArray(body.slugs) ? body.slugs.filter((s): s is string => typeof s === "string").slice(0, 500) : [];
  revalidatePaths([...workPaths(), ...slugs.map((s) => `/work/${s}`)]);
  return NextResponse.json({ revalidated: 3 + slugs.length });
}
