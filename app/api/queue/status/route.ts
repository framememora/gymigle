import { db } from "@/lib/supabase";
import { getPid } from "@/lib/player";
import { logEvent } from "@/lib/events";
import { fail } from "@/lib/http";

// Polled while waiting. Re-runs matchmaking so two players who joined at the
// same instant still find each other, and keeps last_seen fresh.
export async function POST() {
  const pid = await getPid();
  if (!pid) return fail("No session", 401);
  const { data: battleId, error } = await db().rpc("join_queue", { p_pid: pid });
  if (error) return fail(error.message, 500);
  if (battleId) await logEvent(pid, "matched", battleId);
  return Response.json({ battleId });
}
