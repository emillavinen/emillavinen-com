import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/dispatch/admin";
import { isBlobConfigured } from "@/lib/dispatch/blob";

// Issues client-upload tokens for the drop page. The browser sends files
// straight to Vercel Blob because Vercel functions reject request bodies
// over 4.5 MB. Images only: videos and HEIC are refused here as well as in
// the page. Variants are made afterwards by /api/admin/dispatch/drop.
export const runtime = "nodejs";

const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isBlobConfigured()) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is not set — uploads are off." }, { status: 503 });
  }
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("uploads/")) throw new Error("Uploads must go under uploads/");
        return {
          allowedContentTypes: UPLOAD_TYPES,
          maximumSizeInBytes: 60 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
