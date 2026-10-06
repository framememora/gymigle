"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, formatDuration, joinQueue, saveNickname, savedNickname } from "@/lib/client";
import type { BattleHourStatus } from "@/lib/battleHour";

export default function Home() {
  const router = useRouter();
  const [hour, setHour] = useState<BattleHourStatus | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [nickname, setNickname] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNickname(savedNickname());
    api<{ battleHour: BattleHourStatus }>("/api/session", {})
      .then((r) => {
        setHour(r.battleHour);
        setLoadedAt(Date.now());
      })
      .catch((e) => setError(e.message));
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const untilOpen = hour ? hour.msUntilOpen - (now - loadedAt) : 0;
  const open = hour?.open || (hour !== null && untilOpen <= 0);

  async function findOpponent(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const nick = nickname.trim();
    if (!nick) return setError("Pick a nickname.");
    if (!adult) return setError("You must be 18 or older.");
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setBusy(false);
      return setError("We need your camera and mic. Allow access in your browser settings and try again.");
    }
    try {
      saveNickname(nick);
      router.push(await joinQueue(nick));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-10">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-lime-400">Live 1v1</p>
        <h1 className="mt-2 text-5xl font-black leading-none">PUSH-UP BATTLE</h1>
        <p className="mt-4 text-lg text-zinc-300">60 seconds. One random stranger. Most push-ups wins.</p>
      </header>

      {hour === null && !error && <p className="text-center text-zinc-500">Loading…</p>}

      {hour !== null && open && (
        <form onSubmit={findOpponent} className="flex flex-col gap-4 rounded-2xl bg-zinc-900/60 p-5">
          <p className="text-center font-bold text-lime-400">● Battle Hour is LIVE</p>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-400">Nickname</span>
            <input
              className="input"
              value={nickname}
              maxLength={20}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. IronMike"
              autoComplete="nickname"
            />
          </label>
          <label className="flex items-center gap-3 text-zinc-300">
            <input type="checkbox" className="size-5 accent-lime-400" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            I&apos;m 18 or older
          </label>
          <button className="btn-primary text-lg" disabled={busy}>
            {busy ? "Starting…" : "Find opponent"}
          </button>
        </form>
      )}

      {hour !== null && !open && <ClosedPanel untilOpen={untilOpen} />}

      {error && <p className="rounded-xl bg-red-950 p-3 text-center text-red-300">{error}</p>}

      <section className="space-y-2 text-sm text-zinc-400">
        <h2 className="font-bold text-zinc-200">How it works</h2>
        <p>1. You get paired with a random stranger on video.</p>
        <p>2. Prop your phone so your whole body is visible from the side.</p>
        <p>3. 60 seconds of push-ups. Count your own reps; your opponent is watching.</p>
        <p>4. Enter your score. Most reps wins. Battle again.</p>
        <p className="pt-2 text-zinc-500">
          Keep it clean. Anyone can hit <b>End &amp; Report</b> to end a battle instantly. Battles are monitored.
        </p>
      </section>
    </main>
  );
}

function ClosedPanel({ untilOpen }: { untilOpen: number }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/signup", { email });
      setState("sent");
    } catch (err) {
      setState("error");
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-900/60 p-5 text-center">
      <p className="text-zinc-400">Battles happen during Battle Hour, once a day, so there&apos;s always someone to fight.</p>
      <p className="text-sm uppercase tracking-widest text-zinc-500">Next Battle Hour in</p>
      <p className="font-mono text-5xl font-black text-lime-400">{formatDuration(untilOpen)}</p>
      {state === "sent" ? (
        <p className="text-lime-300">You&apos;re in. We&apos;ll email you 15 minutes before it starts.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
          />
          <button className="btn-primary">Remind me</button>
          {state === "error" && <p className="text-sm text-red-400">{msg}</p>}
        </form>
      )}
    </div>
  );
}
