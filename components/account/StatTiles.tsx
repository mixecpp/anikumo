"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, CheckCircle2, Clock, Flame, Hourglass, MonitorPlay } from "lucide-react";

const ICONS = { time: Clock, week: CalendarCheck, episodes: MonitorPlay, streak: Flame, completed: CheckCircle2, avg: Hourglass };

export type Tile = { key: keyof typeof ICONS; label: string; value: number; format?: "duration"; hint?: string };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m % 60}m`;
}

function CountUp({ to, format }: { to: number; format?: "duration" }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return setN(to);
    const controls = animate(0, to, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(v) });
    return () => controls.stop();
  }, [to, reduce]);
  return <>{format === "duration" ? formatDuration(n) : Math.round(n).toLocaleString()}</>;
}

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t, i) => {
        const Icon = ICONS[t.key];
        return (
          <motion.div
            key={t.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="group bg-bg p-4 transition-colors hover:bg-panel"
            title={t.hint}
          >
            <Icon className="h-4 w-4 text-muted transition-colors group-hover:text-accent" />
            <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
              <CountUp to={t.value} format={t.format} />
            </div>
            <div className="mt-0.5 text-xs text-muted">{t.label}</div>
          </motion.div>
        );
      })}
    </section>
  );
}
