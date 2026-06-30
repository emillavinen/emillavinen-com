import { NextResponse } from "next/server";
import { pingSitemap } from "@/lib/sitemap-ping";

// Called by Vercel deploy webhook after each successful deployment
export async function POST() {
  await pingSitemap();
  return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}

export async function GET() {
  await pingSitemap();
  return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}
