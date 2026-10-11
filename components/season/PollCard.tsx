"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePrefs } from "../PrefsProvider";

type Poll = { id: string; title: string; options: { anilistId: number; title: string; cover: string }[]; counts: Record<number, number>; total: number; myVote: number | null };

export default function PollCard({ poll }: { poll: Poll }) {
  const router = useRouter();
  const { loggedIn } = usePrefs();
  const [state, setState] = useState({ counts: poll.counts, total: poll.total, myVote: poll.myVote });
  const voted = state.myVote !== null;

  async function vote(anilistId: number) {
    if (!loggedIn) {
      toast("Log in to vote", "info");
      return router.push("/login?next=/season");
    }
    const prev = state;
    setState((s) => {
      const counts = { ...s.counts };
      if (s.myVote !== null) counts[s.myVote] = Math.max(0, (counts[s.myVote] ?? 1) - 1);
      counts[anilistId] = (counts[anilistId] ?? 0) + 1;
      return { counts, total: s.total + (s.myVote === null ? 1 : 0), myVote: anilistId };
    });
    const res = await fetch("/api/polls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pollId: poll.id, anilistId }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState(prev);
      return toast(json.error ?? "Couldn't vote", "error");
    }
    setState({ counts: json.counts, total: json.total, myVote: json.myVote });
  }

  return (
    <section className="panel rounded-2xl p-5">
      <div className="label">Community poll</div>
      <h2 className="mt-1.5 text-base font-semibold tracking-tight">{poll.title}</h2>
      <p className="mt-0.5 font-mono text-[11px] text-muted">
        {state.total} vote{state.total === 1 ? "" : "s"}
        {voted ? " · tap another to change" : ""}
      </p>
      <ul className="mt-4 space-y-1.5">
        {poll.options.map((o) => {
          const c = state.counts[o.anilistId] ?? 0;
          const pct = state.total ? Math.round((c / state.total) * 100) : 0;
          const mine = state.myVote === o.anilistId;
          return (
            <li key={o.anilistId}>
              <button onClick={() => vote(o.anilistId)} className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-sm transition-colors ${mine ? "border-accent/50" : "border-white/[0.06] hover:border-white/15"}`}>
                {voted && <motion.span className="absolute inset-y-0 left-0 bg-white/[0.06]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.cover} alt="" className="relative h-8 w-6 shrink-0 rounded object-cover" />
                <span className="relative flex-1 truncate">{o.title}</span>
                {mine && <Check className="relative h-3.5 w-3.5 text-accent" />}
                {voted && <span className="relative w-9 text-right font-mono text-[11px] tabular-nums text-muted">{pct}%</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
