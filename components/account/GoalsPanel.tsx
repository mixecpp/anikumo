"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Plus, Target, X } from "lucide-react";
import type { GoalView } from "@/lib/goals";
import { toast } from "@/lib/toast";
import Select from "../Select";

const METRIC = { episodes: "episodes", shows: "shows finished", hours: "hours" } as const;

function Ring({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-white/[0.08]" />
      <motion.circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className={pct >= 1 ? "stroke-success" : "stroke-accent"}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, pct)) }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

export default function GoalsPanel({ goals }: { goals: GoalView[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ metric: "episodes", period: "week", target: "10" });

  async function save(metric: string, period: string, target: number) {
    const res = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metric, period, target }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return toast(json.error ?? "Couldn't save goal", "error");
    setAdding(false);
    router.refresh();
  }

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Goals</h2>
        {!adding && goals.length < 6 && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-muted hover:text-fg">
            <Plus className="h-4 w-4" /> New goal
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((g) => {
          const pct = g.target ? g.current / g.target : 0;
          const daysLeft = Math.max(0, Math.ceil((new Date(g.endsAt).getTime() - Date.now()) / 86_400_000));
          return (
            <div key={`${g.metric}-${g.period}`} className="panel group relative flex items-center gap-4 rounded-xl p-3">
              <div className="relative">
                <Ring pct={pct} />
                <span className="absolute inset-0 grid place-items-center font-mono text-[11px] tabular-nums">{Math.min(100, Math.round(pct * 100))}%</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-semibold tabular-nums">{g.current}</span>
                  <span className="text-muted"> / {g.target} {METRIC[g.metric]}</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  this {g.period} · {pct >= 1 ? "done ✓" : `${daysLeft}d left`}
                </div>
              </div>
              <button onClick={() => save(g.metric, g.period, 0)} className="absolute right-2 top-2 rounded p-1 text-muted opacity-0 transition hover:text-fg group-hover:opacity-100" aria-label="Remove goal">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(form.metric, form.period, Number(form.target));
            }}
            className="panel flex flex-col gap-2 rounded-xl p-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted" />
              <input type="number" min={1} max={1000} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="input !w-20 !py-1.5 text-sm" aria-label="Target" />
              <Select label="Metric" value={form.metric} onChange={(metric) => setForm({ ...form, metric })} options={[{ value: "episodes", label: "episodes" }, { value: "hours", label: "hours" }, { value: "shows", label: "shows finished" }]} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Select label="Period" value={form.period} onChange={(period) => setForm({ ...form, period })} options={[{ value: "week", label: "per week" }, { value: "month", label: "per month" }]} className="flex-1" />
              <button className="btn btn-primary !py-2">Save</button>
              <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost btn-icon" aria-label="Cancel">
                <X className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
        {!goals.length && !adding && (
          <button onClick={() => setAdding(true)} className="rounded-xl border border-dashed border-white/[0.1] p-4 text-left text-sm text-muted transition-colors hover:border-white/20 hover:text-fg">
            Set a goal — e.g. 20 episodes a week. Progress uses real watch time.
          </button>
        )}
      </div>
    </section>
  );
}
