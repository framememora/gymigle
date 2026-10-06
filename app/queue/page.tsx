"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, formatDuration } from "@/lib/client";

export default function Queue() {
  const router = useRouter();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const { battleId } = await api<{ battleId: string | null }>("/api/queue/status", {});
        if (stopped) return;
        if (battleId) {
          stopped = true;
          router.replace(`/battle/${battleId}`);
          return;
        }
        setError("");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return router.replace("/");
        setError("Connection trouble, retrying…");
      }
    }
    poll();
    const p = setInterval(poll, 1500);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearInterval(p);
      clearInterval(t);
    };
  }, [router]);

  async function cancel() {
    await api("/api/queue/leave", {}).catch(() => {});
    router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="size-16 animate-ping rounded-full bg-lime-400/70" />
      <h1 className="text-3xl font-black">Finding an opponent…</h1>
      <p className="font-mono text-xl text-zinc-400">{formatDuration(now - startedAt)}</p>
      <p className="text-zinc-400">Get your phone propped up and your space cleared while you wait.</p>
      {error && <p className="text-sm text-amber-400">{error}</p>}
      <button className="btn-ghost" onClick={cancel}>
        Cancel
      </button>
    </main>
  );
}
