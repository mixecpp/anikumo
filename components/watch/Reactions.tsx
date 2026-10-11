"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { REACTIONS } from "@/lib/reactions";
import { toast } from "@/lib/toast";
import { usePrefs } from "../PrefsProvider";

export default function Reactions({ anilistId, episode }: { anilistId: number; episode: number }) {
  const { loggedIn } = usePrefs();
  const [state, setState] = useState<{ counts: Record<string, number>; mine: string[] }>({ counts: {}, mine: [] });

  useEffect(() => {
    fetch(`/api/reactions?anilistId=${anilistId}&episode=${episode}`)
      .then((r) => r.json())
      .then((j) => setState({ counts: j.counts ?? {}, mine: j.mine ?? [] }))
      .catch(() => {});
  }, [anilistId, episode]);

  async function toggle(id: string) {
    if (!loggedIn) return toast("Log in to react", "info");
    const had = state.mine.includes(id);
    setState((s) => ({ counts: { ...s.counts, [id]: Math.max(0, (s.counts[id] ?? 0) + (had ? -1 : 1)) }, mine: had ? s.mine.filter((x) => x !== id) : [...s.mine, id] }));
    const res = await fetch("/api/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anilistId, episode, emoji: id }) });
    const j = await res.json().catch(() => null);
    if (res.ok && j) setState({ counts: j.counts, mine: j.mine });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Episode reactions">
      <span className="label mr-1">React</span>
      {REACTIONS.map((r) => {
        const on = state.mine.includes(r.id);
        const n = state.counts[r.id] ?? 0;
        return (
          <motion.button
            key={r.id}
            whileTap={{ scale: 0.88 }}
            onClick={() => toggle(r.id)}
            title={r.label}
            aria-pressed={on}
            aria-label={`${r.label}${n ? `, ${n}` : ""}`}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors ${on ? "border-accent/50 bg-accent/10" : "border-white/[0.08] hover:border-white/20"}`}
          >
            <span>{r.emoji}</span>
            {n > 0 && <span className="font-mono text-[11px] tabular-nums text-muted">{n}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
