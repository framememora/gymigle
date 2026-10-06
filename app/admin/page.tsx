"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Snapshot = {
  serverNow: string;
  queue: { pid: string; nickname?: string; joined_at: string; last_seen: string; battle_id: string | null }[];
  battles: {
    id: string;
    a_nick?: string;
    b_nick?: string;
    a_reps: number | null;
    b_reps: number | null;
    status: string;
    disputed: boolean;
    created_at: string;
  }[];
  reports: { id: number; battle_id: string; reporter_nick?: string; reported_nick?: string; created_at: string }[];
};

const FOUNDER_FALLBACK_S = 45;

export default function Admin() {
  const [key, setKey] = useState("");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [founderMsg, setFounderMsg] = useState("");

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("key") ?? "";
    setKey(k);
    const load = () =>
      api<Snapshot>(`/api/admin?key=${encodeURIComponent(k)}`)
        .then((s) => {
          setSnap(s);
          setError("");
        })
        .catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  async function markFounder() {
    try {
      await api(`/api/admin/founder?key=${encodeURIComponent(key)}`, {});
      setFounderMsg("This browser is now excluded from metrics.");
    } catch (e) {
      setFounderMsg((e as Error).message);
    }
  }

  const serverNow = snap ? Date.parse(snap.serverNow) : 0;
  const waitS = (iso: string) => Math.round((serverNow - Date.parse(iso)) / 1000);
  const waiting = snap?.queue.filter((q) => !q.battle_id && waitS(q.last_seen) < 6) ?? [];
  const live = snap?.battles.filter((b) => b.status === "matched" || b.status === "scoring") ?? [];
  const recent = snap?.battles.filter((b) => b.status !== "matched" && b.status !== "scoring") ?? [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 text-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Battle Hour monitor</h1>
        <button className="btn-ghost text-xs" onClick={markFounder}>
          Mark this browser as founder
        </button>
      </header>
      {founderMsg && <p className="text-lime-300">{founderMsg}</p>}
      {error && <p className="text-red-400">{error}</p>}

      <Section title={`Waiting (${waiting.length})`}>
        {waiting.map((q) => {
          const s = waitS(q.joined_at);
          return (
            <Row key={q.pid} alert={s > FOUNDER_FALLBACK_S}>
              <span>{q.nickname ?? "?"}</span>
              <span className="font-mono">
                {s}s{s > FOUNDER_FALLBACK_S && ": join as their opponent now"}
              </span>
            </Row>
          );
        })}
      </Section>

      <Section title={`Live battles (${live.length})`}>
        {live.map((b) => (
          <Row key={b.id}>
            <span>
              {b.a_nick} vs {b.b_nick}
            </span>
            <span className="font-mono">{b.status}</span>
          </Row>
        ))}
      </Section>

      <Section title={`Reports (${snap?.reports.length ?? 0})`}>
        {snap?.reports.map((r) => (
          <Row key={r.id} alert>
            <span>
              {r.reporter_nick} reported {r.reported_nick}
            </span>
            <span className="font-mono">{new Date(r.created_at).toLocaleTimeString()}</span>
          </Row>
        ))}
      </Section>

      <Section title="Finished (last 3h)">
        {recent.map((b) => (
          <Row key={b.id} alert={b.disputed || b.status === "reported"}>
            <span>
              {b.a_nick} {b.a_reps ?? "–"} : {b.b_reps ?? "–"} {b.b_nick}
            </span>
            <span className="font-mono">
              {b.status}
              {b.disputed && " · disputed"}
            </span>
          </Row>
        ))}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-bold uppercase tracking-wider text-zinc-400">{title}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Row({ children, alert }: { children: React.ReactNode; alert?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 rounded-lg px-3 py-2 ${alert ? "bg-red-950 text-red-200" : "bg-zinc-900"}`}
    >
      {children}
    </div>
  );
}
