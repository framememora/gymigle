import { db } from "@/lib/supabase";
import { getPid } from "@/lib/player";
import { deleteRoom } from "@/lib/daily";
import { loadBattle, side } from "@/lib/battle";
import { fail } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = await getPid();
  if (!pid) return fail("No session", 401);
  const b = await loadBattle(id);
  if (!b || !side(b, pid)) return fail("Battle not found", 404);

  await db().from("battles").update({ status: "reported" }).eq("id", id);
  await db()
    .from("reports")
    .insert({ battle_id: id, reporter: pid, reported: side(b, pid) === "a" ? b.player_b : b.player_a });
  if (b.room_name) await deleteRoom(b.room_name);
  return Response.json({ ok: true });
}
