"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { api, ApiError, joinQueue, savedNickname } from "@/lib/client";
import type { BattleView } from "@/lib/battle";

type Phase = "connecting" | "countdown" | "live" | "score" | "waiting" | "done" | "reported" | "error";

function phaseOf(b: BattleView, now: number): Phase {
  if (b.status === "reported") return "reported";
  if (b.status === "error") return "error";
  if (b.status === "done") return "done";
  if (!b.roomUrl || !b.startsAt || !b.endsAt) return "connecting";
  if (now < Date.parse(b.startsAt)) return "countdown";
  if (now < Date.parse(b.endsAt)) return "live";
  return b.me.reps === null ? "score" : "waiting";
}

export default function Battle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [battle, setBattle] = useState<BattleView | null>(null);
  const [offset, setOffset] = useState(0); // server clock − local clock
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  const phase = battle ? phaseOf(battle, now + offset) : "connecting";
  const finished = phase === "done" || phase === "reported" || phase === "error";

  // Poll battle state until it's over.
  useEffect(() => {
    if (finished) return;
    let stopped = false;
    async function poll() {
      try {
        const b = await api<BattleView>(`/api/battle/${id}`);
        if (stopped) return;
        setOffset(Date.parse(b.serverNow) - Date.now());
        setBattle(b);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) router.replace("/");
      }
    }
    poll();
    const p = setInterval(poll, 1000);
    return () => {
      stopped = true;
      clearInterval(p);
    };
  }, [id, finished, router]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  async function report() {
    await api(`/api/battle/${id}/report`, {}).catch(() => {});
    setBattle((b) => (b ? { ...b, status: "reported" } : b));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-4">
      {!finished && (
        <>
          <div className="relative">
            <Video roomUrl={battle?.roomUrl ?? null} nickname={battle?.me.nickname ?? ""} />
            <Hud battle={battle} phase={phase} now={now + offset} />
          </div>
          {phase === "score" && battle && (
            <ScoreForm id={id} onSubmitted={setBattle} onError={setError} />
          )}
          {phase === "waiting" && (
            <p className="text-center text-zinc-400">Waiting for {battle?.opp.nickname}&apos;s score…</p>
          )}
          <button className="btn-danger self-center" onClick={report}>
            End &amp; Report
          </button>
        </>
      )}

      {phase === "done" && battle && <Result battle={battle} />}

      {phase === "reported" && (
        <Ended title="Battle ended" text="This battle was ended and flagged for review. Thanks for keeping it clean." />
      )}
      {phase === "error" && <Ended title="Video setup failed" text="Something went wrong creating the video room." />}

      {error && <p className="text-center text-red-400">{error}</p>}
    </main>
  );
}

function Video({ roomUrl, nickname }: { roomUrl: string | null; nickname: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomUrl || !ref.current) return;
    let call: DailyCall | null = null;
    let cancelled = false;
    (async () => {
      await DailyIframe.getCallInstance()?.destroy();
      if (cancelled || !ref.current) return;
      call = DailyIframe.createFrame(ref.current, {
        iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "16px" },
        showLeaveButton: false,
        showFullscreenButton: false,
      });
      await call.join({ url: roomUrl, userName: nickname });
    })().catch(console.error);
    return () => {
      cancelled = true;
      call?.destroy();
    };
  }, [roomUrl, nickname]);

  return (
    <div ref={ref} className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-900 sm:aspect-video">
      {!roomUrl && <p className="flex h-full items-center justify-center text-zinc-500">Connecting video…</p>}
    </div>
  );
}

function Hud({ battle, phase, now }: { battle: BattleView | null; phase: Phase; now: number }) {
  if (!battle) return null;
  let big = "";
  let small = "";
  if (phase === "countdown") {
    const s = Math.ceil((Date.parse(battle.startsAt!) - now) / 1000);
    big = s <= 3 ? String(s) : "";
    small = s <= 3 ? "" : `Get in position: starting in ${s}s`;
  } else if (phase === "live") {
    const s = Math.ceil((Date.parse(battle.endsAt!) - now) / 1000);
    big = String(s);
    small = s > 57 ? "GO!" : "Count your reps";
  } else if (phase === "score" || phase === "waiting") {
    big = "TIME";
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 p-3">
      <p className="rounded-full bg-black/60 px-3 py-1 text-sm font-semibold">
        {battle.me.nickname} <span className="text-lime-400">vs</span> {battle.opp.nickname}
      </p>
      {big && (
        <p className="font-mono text-7xl font-black text-lime-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{big}</p>
      )}
      {small && <p className="rounded-full bg-black/60 px-3 py-1 font-bold">{small}</p>}
    </div>
  );
}

function ScoreForm({
  id,
  onSubmitted,
  onError,
}: {
  id: string;
  onSubmitted: (b: BattleView) => void;
  onError: (msg: string) => void;
}) {
  const [reps, setReps] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onSubmitted(await api<BattleView>(`/api/battle/${id}/score`, { reps: Number(reps) }));
      onError("");
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
      <label className="text-center text-lg font-bold">How many push-ups did you do?</label>
      <input
        className="input text-center font-mono text-3xl"
        type="number"
        inputMode="numeric"
        min={0}
        max={200}
        required
        autoFocus
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />
      <button className="btn-primary text-lg" disabled={busy || reps === ""}>
        Submit score
      </button>
    </form>
  );
}

function Result({ battle }: { battle: BattleView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [disputed, setDisputed] = useState(battle.disputed);
  const { me, opp } = battle;
  const incomplete = me.reps === null || opp.reps === null;

  let headline = "TIE";
  if (incomplete) headline = me.reps === null ? "No score entered" : "Opponent left";
  else if (me.reps! > opp.reps!) headline = "YOU WIN";
  else if (me.reps! < opp.reps!) headline = "YOU LOSE";

  async function again() {
    setBusy(true);
    try {
      router.replace(await joinQueue(savedNickname() || me.nickname, true));
    } catch {
      router.replace("/");
    }
  }

  async function dispute() {
    setDisputed(true);
    await api(`/api/battle/${battle.id}/dispute`, {}).catch(() => {});
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className={`text-6xl font-black ${headline === "YOU WIN" ? "text-lime-400" : "text-zinc-100"}`}>{headline}</p>
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Score label={me.nickname + " (you)"} reps={me.reps} />
        <Score label={opp.nickname} reps={opp.reps} />
      </div>
      <button className="btn-primary w-full max-w-sm py-5 text-2xl" onClick={again} disabled={busy}>
        {busy ? "Finding opponent…" : "Battle again"}
      </button>
      <div className="flex gap-3">
        {!incomplete && (
          <button className="btn-ghost text-sm" onClick={dispute} disabled={disputed}>
            {disputed ? "Score disputed" : "Dispute score"}
          </button>
        )}
        <button className="btn-ghost text-sm" onClick={() => router.replace("/")}>
          Done for today
        </button>
      </div>
    </div>
  );
}

function Score({ label, reps }: { label: string; reps: number | null }) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-4">
      <p className="truncate text-sm text-zinc-400">{label}</p>
      <p className="font-mono text-5xl font-black">{reps ?? "–"}</p>
    </div>
  );
}

function Ended({ title, text }: { title: string; text: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-3xl font-black">{title}</p>
      <p className="text-zinc-400">{text}</p>
      <button className="btn-primary" onClick={() => router.replace("/")}>
        Back to start
      </button>
    </div>
  );
}
