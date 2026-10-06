// Daily Battle Hour window, evaluated in BATTLE_HOUR_TZ. Shared by server and client.

export type BattleHourConfig = {
  start: string; // "HH:MM"
  minutes: number;
  tz: string;
  alwaysOpen: boolean;
};

export function battleHourConfig(): BattleHourConfig {
  return {
    start: process.env.BATTLE_HOUR_START ?? "20:00",
    minutes: Number(process.env.BATTLE_HOUR_MINUTES ?? 30),
    tz: process.env.BATTLE_HOUR_TZ ?? "America/New_York",
    alwaysOpen: process.env.BATTLE_HOUR_ALWAYS_OPEN === "true",
  };
}

/** Minutes since local midnight in `tz`. */
function minutesInTz(now: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute") + get("second") / 60;
}

export type BattleHourStatus = { open: boolean; msUntilOpen: number; msUntilClose: number };

export function battleHourStatus(cfg: BattleHourConfig, now = new Date()): BattleHourStatus {
  if (cfg.alwaysOpen) return { open: true, msUntilOpen: 0, msUntilClose: Infinity };
  const [h, m] = cfg.start.split(":").map(Number);
  const startMin = h * 60 + m;
  const nowMin = minutesInTz(now, cfg.tz);
  const sinceStart = (nowMin - startMin + 1440) % 1440;
  const open = sinceStart < cfg.minutes;
  const minUntilOpen = open ? 0 : 1440 - sinceStart;
  return {
    open,
    msUntilOpen: Math.round(minUntilOpen * 60_000),
    msUntilClose: open ? Math.round((cfg.minutes - sinceStart) * 60_000) : 0,
  };
}
