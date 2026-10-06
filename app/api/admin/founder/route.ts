import { db } from "@/lib/supabase";
import { getOrSetPid } from "@/lib/player";
import { fail, isAdmin } from "@/lib/http";

// Marks this browser's player as the founder so metrics.sql excludes them.
export async function POST(req: Request) {
  if (!isAdmin(req)) return fail("Forbidden", 403);
  const pid = await getOrSetPid();
  await db().from("players").update({ is_founder: true }).eq("id", pid);
  return Response.json({ ok: true, pid });
}
