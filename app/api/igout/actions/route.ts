import { isSyncRequest } from "@/lib/igout/auth";
import { pendingTaps } from "@/lib/igout/db";

/** The Mac fetches the taps made on /admin/instagram that it hasn't applied yet. */
export async function GET(request: Request) {
  if (!isSyncRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json({ actions: await pendingTaps() });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Database error" }, { status: 500 });
  }
}
