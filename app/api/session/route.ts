import { getOrSetPid } from "@/lib/player";
import { logEvent } from "@/lib/events";
import { battleHourConfig, battleHourStatus } from "@/lib/battleHour";

export async function POST() {
  const pid = await getOrSetPid();
  await logEvent(pid, "session_start");
  return Response.json({ battleHour: battleHourStatus(battleHourConfig()) });
}
