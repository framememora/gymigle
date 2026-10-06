import "server-only";
import { db } from "./supabase";
import { createRoom, deleteRoom } from "./daily";
import { logEvent } from "./events";

export const COUNTDOWN_MS = 12_000; // time for both video feeds to connect
export const BATTLE_MS = 60_000;
export const SCORE_GRACE_MS = 45_000; // after this, a missing score ends the battle as incomplete
export const MAX_REPS = 200;

export type BattleRow = {
  id: string;
  player_a: string;
  player_b: string;
  room_name: string | null;
  room_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  a_reps: number | null;
  b_reps: number | null;
  status: "matched" | "scoring" | "done" | "reported" | "error";
  disputed: boolean;
  completed_at: string | null;
};

async function fetchBattle(id: string): Promise<BattleRow | null> {
  const { data } = await db().from("battles").select("*").eq("id", id).maybeSingle();
  return (data as BattleRow) ?? null;
}

/**
 * Loads a battle and advances its state lazily (no cron): creates the video room
 * on first load, moves to scoring after the timer, and closes out stale scoring.
 */
export async function loadBattle(id: string): Promise<BattleRow | null> {
  let b = await fetchBattle(id);
  if (!b) return null;
  const now = Date.now();

  if (b.status === "matched" && !b.room_url) {
    try {
      const room = await createRoom();
      const startsAt = new Date(now + COUNTDOWN_MS);
      const { data } = await db()
        .from("battles")
        .update({
          room_name: room.name,
          room_url: room.url,
          starts_at: startsAt.toISOString(),
          ends_at: new Date(startsAt.getTime() + BATTLE_MS).toISOString(),
        })
        .eq("id", id)
        .is("room_url", null)
        .select();
      if (!data?.length) {
        // The other player's request created the room first; drop ours.
        await deleteRoom(room.name);
      }
    } catch (e) {
      console.error(e);
      await db().from("battles").update({ status: "error" }).eq("id", id).eq("status", "matched");
    }
    b = (await fetchBattle(id))!;
  }

  const endsAt = b.ends_at ? Date.parse(b.ends_at) : null;
  if (b.status === "matched" && endsAt && now >= endsAt) {
    await db().from("battles").update({ status: "scoring" }).eq("id", id).eq("status", "matched");
    b = (await fetchBattle(id))!;
  }
  if (b.status === "scoring" && endsAt && now >= endsAt + SCORE_GRACE_MS) {
    await db()
      .from("battles")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "scoring");
    b = (await fetchBattle(id))!;
  }
  return b;
}

export function side(b: BattleRow, pid: string): "a" | "b" | null {
  if (b.player_a === pid) return "a";
  if (b.player_b === pid) return "b";
  return null;
}

/** Records a player's reps; closes the battle when both are in. */
export async function submitScore(b: BattleRow, pid: string, reps: number) {
  const s = side(b, pid)!;
  const col = s === "a" ? "a_reps" : "b_reps";
  await db().from("battles").update({ [col]: reps }).eq("id", b.id).is(col, null);

  const fresh = (await fetchBattle(b.id))!;
  if (fresh.a_reps !== null && fresh.b_reps !== null && fresh.status !== "done") {
    const { data } = await db()
      .from("battles")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", b.id)
      .in("status", ["matched", "scoring"])
      .select();
    if (data?.length) {
      await Promise.all([
        logEvent(fresh.player_a, "battle_completed", b.id, { reps: fresh.a_reps }),
        logEvent(fresh.player_b, "battle_completed", b.id, { reps: fresh.b_reps }),
      ]);
    }
  }
}

/** The battle as one player sees it. */
export async function battleView(b: BattleRow, pid: string) {
  const s = side(b, pid)!;
  const oppId = s === "a" ? b.player_b : b.player_a;
  const { data: players } = await db()
    .from("players")
    .select("id, nickname")
    .in("id", [pid, oppId]);
  const nick = (id: string) => players?.find((p) => p.id === id)?.nickname ?? "Anonymous";
  return {
    id: b.id,
    status: b.status,
    roomUrl: b.room_url,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    scoreDeadline: b.ends_at ? new Date(Date.parse(b.ends_at) + SCORE_GRACE_MS).toISOString() : null,
    serverNow: new Date().toISOString(),
    disputed: b.disputed,
    me: { nickname: nick(pid), reps: s === "a" ? b.a_reps : b.b_reps },
    opp: { nickname: nick(oppId), reps: s === "a" ? b.b_reps : b.a_reps },
  };
}

export type BattleView = Awaited<ReturnType<typeof battleView>>;
