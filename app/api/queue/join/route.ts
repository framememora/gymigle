import { db } from "@/lib/supabase";
import { getOrSetPid } from "@/lib/player";
import { logEvent } from "@/lib/events";
import { fail } from "@/lib/http";
import { battleHourConfig, battleHourStatus } from "@/lib/battleHour";

export async function POST(req: Request) {
  if (!battleHourStatus(battleHourConfig()).open) return fail("Battle Hour is closed", 403);

  const body = await req.json().catch(() => ({}));
  const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 20) : "";
  if (!nickname) return fail("Pick a nickname");
  if (body.adult !== true) return fail("You must be 18+");

  const pid = await getOrSetPid();
  await db().from("players").update({ nickname }).eq("id", pid);
  if (body.again === true) await logEvent(pid, "battle_again_clicked");
  await logEvent(pid, "joined_queue");

  const { data: battleId, error } = await db().rpc("join_queue", { p_pid: pid });
  if (error) return fail(error.message, 500);
  if (battleId) await logEvent(pid, "matched", battleId);
  return Response.json({ battleId });
}
