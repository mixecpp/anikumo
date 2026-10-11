"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Star } from "lucide-react";
import FadeRow from "./FadeRow";

type Item = {
  id: number;
  anilistId: number;
  airingAt: number;
  episode: number;
  title: string;
  cover: string;
  format: string | null;
  total: number | null;
  score: number | null;
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function countdown(ms: number) {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `in ${h}h ${m % 60}m` : `in ${Math.floor(h / 24)}d`;
}

const timeFmt: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export default function ScheduleView({ items, mine, loggedIn }: { items: Item[]; mine: number[]; loggedIn: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [query, setQuery] = useState("");
  const mineSet = useMemo(() => new Set(mine), [mine]);

  useEffect(() => {
    setNow(Date.now());
    setDay(dayKey(new Date()));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { date: Date; items: Item[] }>();
    for (const it of items) {
      const d = new Date(it.airingAt * 1000);
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [] });
      if (onlyMine && !mineSet.has(it.anilistId)) continue;
      if (q && !it.title.toLowerCase().includes(q)) continue;
      map.get(k)!.items.push(it);
    }
    return [...map.entries()].slice(0, 8);
  }, [items, onlyMine, mineSet, query]);

  if (now === null) {
    return (
      <div className="mt-8 space-y-6">
        <div className="skeleton h-16 rounded-2xl" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  const todayKey = dayKey(new Date(now));
  const active = days.find(([k]) => k === day) ?? days.find(([k]) => k === todayKey) ?? days[0];
  const list = active?.[1].items ?? [];

  const slots: { at: number; items: Item[] }[] = [];
  for (const it of list) {
    const last = slots[slots.length - 1];
    if (last && last.at === it.airingAt) last.items.push(it);
    else slots.push({ at: it.airingAt, items: [it] });
  }
  const nextSlotAt = slots.find((s) => s.at * 1000 > now)?.at;

  return (
    <div className="mt-8">
      <FadeRow className="scrollbar-none -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="panel grid min-w-[640px] grid-cols-8 gap-1 rounded-2xl p-1">
          {days.map(([k, { date, items: dayItems }]) => {
            const on = active?.[0] === k;
            const isToday = k === todayKey;
            return (
              <button key={k} onClick={() => setDay(k)} className={`relative rounded-xl px-2 py-2.5 text-center transition-colors ${on ? "text-fg" : "text-muted hover:text-fg"}`}>
                {on && <motion.span layoutId="sched-day" className="absolute inset-0 rounded-xl bg-white/[0.08]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative block text-sm font-medium">
                  {isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="relative mt-0.5 block font-mono text-[11px] text-muted">
                  {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className={`relative mt-1.5 inline-block rounded-full px-1.5 font-mono text-[10px] tabular-nums ${on ? "bg-fg text-bg" : "bg-white/[0.06] text-muted"}`}>
                  {dayItems.length}
                </span>
              </button>
            );
          })}
        </div>
      </FadeRow>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter this week" className="input !py-1.5 !pl-9 text-sm" aria-label="Filter shows" />
        </label>
        {loggedIn && (
          <button
            onClick={() => setOnlyMine((v) => !v)}
            aria-pressed={onlyMine}
            className={`press rounded-full px-3 py-1.5 text-xs transition-colors ${onlyMine ? "bg-fg text-bg" : "bg-white/[0.06] text-fg/75 hover:text-fg"}`}
          >
            My shows only
          </button>
        )}
        {nextSlotAt && slots[0]?.at !== nextSlotAt && (
          <button
            onClick={() => document.getElementById(`slot-${nextSlotAt}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="press rounded-full bg-accent/15 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/25"
          >
            Jump to next
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted">
          {list.length} episode{list.length === 1 ? "" : "s"}
        </span>
      </div>

      {slots.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center text-sm text-muted">
          {onlyMine ? "None of your shows air this day." : query ? "No shows match that filter." : "Nothing scheduled."}
        </div>
      ) : (
        <ol key={active?.[0]} className="relative mt-8">
          <span className="absolute bottom-2 left-[83px] top-2 w-px bg-white/[0.07] max-sm:hidden" aria-hidden />
          {slots.map((slot, si) => {
            const aired = slot.at * 1000 <= now;
            const isNext = slot.at === nextSlotAt;
            return (
              <motion.li
                key={slot.at}
                id={`slot-${slot.at}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(si, 12) * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative grid gap-3 pb-6 sm:grid-cols-[68px_1fr] sm:gap-8"
              >
                <div className="flex items-center gap-2 sm:block sm:pt-3 sm:text-right">
                  <time className={`whitespace-nowrap font-mono text-xs tabular-nums ${isNext ? "text-accent" : aired ? "text-muted" : "text-fg/80"}`}>
                    {new Date(slot.at * 1000).toLocaleTimeString(undefined, timeFmt)}
                  </time>
                  {isNext && <span className="font-mono text-[10px] text-accent sm:mt-0.5 sm:block">{countdown(slot.at * 1000 - now)}</span>}
                  <span
                    className={`absolute left-[79px] top-[15px] h-[9px] w-[9px] rounded-full ring-4 ring-bg max-sm:hidden ${isNext ? "bg-accent" : aired ? "bg-white/20" : "bg-white/40"}`}
                    aria-hidden
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {slot.items.map((it) => (
                    <Link
                      key={it.id}
                      href={aired ? `/watch/${it.anilistId}/${it.episode}` : `/anime/${it.anilistId}`}
                      className={`panel group flex gap-3 rounded-xl p-2 transition-colors hover:border-white/15 hover:bg-white/[0.04] ${aired ? "opacity-60 hover:opacity-100" : ""} ${
                        isNext ? "!border-accent/30" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.cover} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                        <div className="flex items-start gap-2">
                          <span className="line-clamp-2 flex-1 text-sm leading-snug">{it.title}</span>
                          {mineSet.has(it.anilistId) && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="In your list" />}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                          <span className="text-fg/75">
                            EP {it.episode}
                            {it.total ? `/${it.total}` : ""}
                          </span>
                          {it.score != null && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-star text-star" />
                              {(it.score / 10).toFixed(1)}
                            </span>
                          )}
                          {aired && <span className="ml-auto text-success">Out now</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
