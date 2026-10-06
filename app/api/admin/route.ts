import { db } from "@/lib/supabase";
import { fail, isAdmin } from "@/lib/http";

export async function GET(req: Request) {
  if (!isAdmin(req)) return fail("Forbidden", 403);
  const since = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  const [queue, battles, reports, players] = await Promise.all([
    db().from("queue").select("pid, joined_at, last_seen, battle_id").order("joined_at"),
    db().from("battles").select("*").gte("created_at", since).order("created_at", { ascending: false }),
    db().from("reports").select("*").order("created_at", { ascending: false }).limit(50),
    db().from("players").select("id, nickname"),
  ]);
  const nick: Record<string, string> = Object.fromEntries(
    (players.data ?? []).map((p) => [p.id, p.nickname ?? "?"]),
  );
  return Response.json({
    serverNow: new Date().toISOString(),
    queue: (queue.data ?? []).map((q) => ({ ...q, nickname: nick[q.pid] })),
    battles: (battles.data ?? []).map((b) => ({ ...b, a_nick: nick[b.player_a], b_nick: nick[b.player_b] })),
    reports: (reports.data ?? []).map((r) => ({
      ...r,
      reporter_nick: nick[r.reporter],
      reported_nick: nick[r.reported],
    })),
  });
}
