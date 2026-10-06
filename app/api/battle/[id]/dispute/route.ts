import { db } from "@/lib/supabase";
import { getPid } from "@/lib/player";
import { loadBattle, side } from "@/lib/battle";
import { fail } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = await getPid();
  if (!pid) return fail("No session", 401);
  const b = await loadBattle(id);
  if (!b || !side(b, pid)) return fail("Battle not found", 404);
  await db().from("battles").update({ disputed: true }).eq("id", id);
  return Response.json({ ok: true });
}
