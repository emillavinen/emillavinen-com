import { isSyncRequest } from "@/lib/igout/auth";
import { saveSnapshot } from "@/lib/igout/db";
import { cleanSnapshot } from "@/lib/igout/logic";

/** The Mac uploads today's unfollow cards and the ids of the taps it applied. */
export async function POST(request: Request) {
  if (!isSyncRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { snapshot?: unknown; applied?: unknown } | null;
  const snapshot = cleanSnapshot(body?.snapshot);
  const applied = Array.isArray(body?.applied) ? body.applied : null;
  if (!snapshot || !applied || !applied.every((id) => Number.isInteger(id))) {
    return Response.json({ error: "Expected { snapshot, applied: number[] }" }, { status: 400 });
  }
  try {
    await saveSnapshot(snapshot, applied as number[]);
    return Response.json({ ok: true, cards: snapshot.cards.length });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Database error" }, { status: 500 });
  }
}
