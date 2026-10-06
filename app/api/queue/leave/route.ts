import { db } from "@/lib/supabase";
import { getPid } from "@/lib/player";

export async function POST() {
  const pid = await getPid();
  if (pid) await db().from("queue").delete().eq("pid", pid).is("battle_id", null);
  return Response.json({ ok: true });
}
