"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Item = {
  id: number;
  anilistId: number;
  airingAt: number;
  episode: number;
  title: string;
  cover: string;
  format: string | null;
  total: number | null;
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ScheduleView({ items }: { items: Item[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    setDay(dayKey(new Date()));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    const map = new Map<string, { date: Date; items: Item[] }>();
    for (const it of items) {
      const d = new Date(it.airingAt * 1000);
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] });
      map.get(k)!.items.push(it);
    }
    return [...map.entries()].slice(0, 8);
  }, [items]);

  if (now === null) return <div className="skeleton mt-8 h-96 rounded-2xl" />;

  const todayKey = dayKey(new Date(now));
  const active = days.find(([k]) => k === day) ?? days[0];

  return (
    <div className="mt-6">
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-2">
        {days.map(([k, { date, items: list }]) => (
          <button
            key={k}
            onClick={() => setDay(k)}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition ${
              active?.[0] === k ? "border-accent bg-accent/15" : "border-line bg-surface hover:border-accent/50"
            }`}
          >
            <div className="text-sm font-semibold">
              {k === todayKey ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
            <div className="text-xs text-muted">
              {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {list.length}
            </div>
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-2">
        {active?.[1].items.map((it) => {
          const aired = it.airingAt * 1000 <= now;
          const diff = it.airingAt * 1000 - now;
          const h = Math.floor(diff / 3_600_000);
          const m = Math.floor((diff % 3_600_000) / 60_000);
          return (
            <li key={it.id}>
              <Link
                href={aired ? `/watch/${it.anilistId}/${it.episode}` : `/anime/${it.anilistId}`}
                className={`flex items-center gap-4 rounded-xl border border-line bg-surface p-2.5 transition hover:border-accent/60 ${aired ? "opacity-70" : ""}`}
              >
                <div className="w-16 shrink-0 text-center font-[family-name:var(--font-display)] text-lg font-bold tabular-nums">
                  {new Date(it.airingAt * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.cover} alt="" loading="lazy" className="h-16 w-11 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.title}</div>
                  <div className="text-xs text-muted">
                    Episode {it.episode}
                    {it.total ? ` of ${it.total}` : ""}
                  </div>
                </div>
                <span className={`shrink-0 text-xs ${aired ? "text-muted" : "text-accent-2"}`}>
                  {aired ? "Aired" : h > 0 ? `in ${h}h ${m}m` : `in ${m}m`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
