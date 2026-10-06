import "server-only";

const API = "https://api.daily.co/v1";

function headers() {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function createRoom(): Promise<{ name: string; url: string }> {
  const res = await fetch(`${API}/rooms`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: `b-${crypto.randomUUID()}`,
      privacy: "public", // the name is an unguessable UUID
      properties: {
        max_participants: 2,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
        eject_at_room_exp: true,
        enable_prejoin_ui: false,
        enable_chat: false,
        enable_screenshare: false,
        start_audio_off: false,
        start_video_off: false,
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily createRoom failed: ${res.status} ${await res.text()}`);
  const room = await res.json();
  return { name: room.name, url: room.url };
}

export async function deleteRoom(name: string): Promise<void> {
  await fetch(`${API}/rooms/${name}`, { method: "DELETE", headers: headers() }).catch(() => {});
}
