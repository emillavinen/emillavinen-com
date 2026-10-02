import { addTap, removeTap } from "@/lib/igout/db";
import { isTapStatus, isThreadId } from "@/lib/igout/logic";

// Signed-in only: middleware.ts guards /api/admin/*.

/** Record a Done/Skip tap from /admin/instagram. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { thread_id?: unknown; status?: unknown } | null;
  if (!isThreadId(body?.thread_id) || !isTapStatus(body?.status)) {
    return Response.json({ error: "Expected { thread_id, status: 'done' | 'skipped' }" }, { status: 400 });
  }
  try {
    return Response.json({ id: await addTap(body.thread_id, body.status) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Database error" }, { status: 500 });
  }
}

/** Undo a tap the Mac hasn't applied yet. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!Number.isInteger(body?.id)) {
    return Response.json({ error: "Expected { id }" }, { status: 400 });
  }
  try {
    const removed = await removeTap(body!.id as number);
    return removed
      ? Response.json({ ok: true })
      : Response.json({ error: "Already picked up by the Mac" }, { status: 409 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Database error" }, { status: 500 });
  }
}
