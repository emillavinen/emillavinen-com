import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dispatch/admin";
import { fetchBytes, isBlobConfigured } from "@/lib/dispatch/blob";
import { BlobBudgetError } from "@/lib/dispatch/budget";
import { parseDropInput } from "@/lib/dispatch/drop";
import { titleFromFileName, UnsupportedImageError } from "@/lib/dispatch/images";
import { serverDeps } from "@/lib/dispatch/next";
import { logEvent } from "@/lib/dispatch/store";
import { createWork } from "@/lib/dispatch/works";

// Turns the drop page's uploads into a work: process the variants, create
// the work, queue it on the ticked platforms, delete the raw uploads (no
// originals are kept).
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const deps = await serverDeps();
  if (!deps || !isBlobConfigured()) {
    return NextResponse.json({ error: "The store is not configured (DATABASE_URL and BLOB_READ_WRITE_TOKEN)." }, { status: 503 });
  }
  const input = parseDropInput(await request.json().catch(() => null), deps.now);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const uploadUrls = input.uploads.map((u) => u.url);
  try {
    const images = [];
    for (const upload of input.uploads) {
      const { buffer } = await fetchBytes(upload.url, deps.fetch, { timeoutMs: 30_000 });
      images.push({ buffer, alt: input.title });
    }
    const { work } = await createWork(
      deps,
      {
        origin: "drop",
        title: input.title,
        fallbackTitle: titleFromFileName(input.uploads[0].name),
        caption: input.caption,
        client: input.client,
        tools: input.tools,
        year: input.year,
        tags: input.tags,
        images,
        extraBlobPuts: input.uploads.length,
      },
      { mode: "queue", platforms: input.platforms }
    );
    await logEvent(deps.db, deps.now, { type: "work_drop", workId: work.id, message: work.title });
    return NextResponse.json({ id: work.id, slug: work.slug, title: work.title });
  } catch (err) {
    const status = err instanceof UnsupportedImageError ? 400 : err instanceof BlobBudgetError ? 507 : 500;
    console.error("[dispatch] drop failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create the work" }, { status });
  } finally {
    await deps.blob.del(uploadUrls).catch((err) => console.warn("[dispatch] could not delete raw uploads", err));
  }
}
