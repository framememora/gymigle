import { getPid } from "@/lib/player";
import { battleView, loadBattle, MAX_REPS, side, submitScore } from "@/lib/battle";
import { fail } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = await getPid();
  if (!pid) return fail("No session", 401);
  const { reps } = await req.json().catch(() => ({}));
  if (!Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) return fail(`Reps must be 0–${MAX_REPS}`);

  const b = await loadBattle(id);
  if (!b || !side(b, pid)) return fail("Battle not found", 404);
  if (b.status !== "scoring") return fail("Scoring is not open", 409);

  await submitScore(b, pid, reps);
  return Response.json(await battleView((await loadBattle(id))!, pid));
}
