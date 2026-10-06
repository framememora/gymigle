import "server-only";
import { db } from "./supabase";

export type EventName =
  | "session_start"
  | "joined_queue"
  | "matched"
  | "battle_completed"
  | "battle_again_clicked";

export async function logEvent(
  pid: string | null,
  name: EventName,
  battleId?: string | null,
  meta?: Record<string, unknown>,
) {
  const { error } = await db()
    .from("events")
    .insert({ pid, name, battle_id: battleId ?? null, meta: meta ?? null });
  if (error) console.error("logEvent failed", name, error.message);
}
