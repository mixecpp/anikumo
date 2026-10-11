"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Play, Search, Trash2 } from "lucide-react";
import type { HistoryEvent, HistoryShow } from "@/lib/account";
import { toast, undoable } from "@/lib/toast";
import ConfirmButton from "./ConfirmButton";

function relative(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export default function HistoryView({ shows: initialShows, events: initialEvents }: { shows: HistoryShow[]; events: HistoryEvent[] }) {
  const router = useRouter();
  const [view, setView] = useState<"shows" | "timeline">("shows");
  const [query, setQuery] = useState("");
  const [shows, setShows] = useState(initialShows);
  const [events, setEvents] = useState(initialEvents);

  const q = query.trim().toLowerCase();
  const filteredShows = useMemo(() => shows.filter((s) => s.title.toLowerCase().includes(q)), [shows, q]);
  const groupedEvents = useMemo(() => {
    const groups: { label: string; items: HistoryEvent[] }[] = [];
    for (const e of events.filter((ev) => ev.title.toLowerCase().includes(q))) {
      const label = relative(e.at);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(e);
      else groups.push({ label, items: [e] });
    }
    return groups;
  }, [events, q]);

  function removeShow(anilistId: number, title: string) {
    const prevShows = shows;
    const prevEvents = events;
    setShows((s) => s.filter((x) => x.anilistId !== anilistId));
    setEvents((e) => e.filter((x) => x.anilistId !== anilistId));
    undoable(`Removed ${title} from history`, {
      commit: () => fetch(`/api/progress?anilistId=${anilistId}`, { method: "DELETE" }).then(() => router.refresh()),
      revert: () => {
        setShows(prevShows);
        setEvents(prevEvents);
      },
    });
  }

  async function clearAll() {
    const res = await fetch("/api/progress?all=1", { method: "DELETE" });
    if (!res.ok) return toast("Couldn't clear history", "error");
    setShows([]);
    setEvents([]);
    toast("Watch history cleared", "info");
    router.refresh();
  }

  if (!initialShows.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
        <p className="text-sm text-muted">Episodes you watch will show up here.</p>
        <Link href="/browse" className="btn btn-ghost mt-4">
          Browse anime
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-white/[0.05] p-0.5 text-sm">
          {(["shows", "timeline"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`relative rounded-md px-3 py-1.5 transition-colors ${view === v ? "text-fg" : "text-muted hover:text-fg"}`}>
              {view === v && <motion.span layoutId="history-view" className="absolute inset-0 rounded-md bg-white/[0.1]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{v === "shows" ? "By show" : "Timeline"}</span>
            </button>
          ))}
        </div>
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter history" className="input !py-1.5 !pl-9 text-sm" />
        </label>
        {shows.length > 0 && (
          <ConfirmButton onConfirm={clearAll} label="Clear history" confirmLabel="Clear all history?" className="ml-auto" />
        )}
      </div>

      {view === "shows" ? (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
          <AnimatePresence initial={false}>
            {filteredShows.map((s) => {
              const next = s.lastCompleted ? s.lastEpisode + 1 : s.lastEpisode;
              return (
                <motion.li key={s.anilistId} layout exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="group flex items-center gap-4 p-3">
                  <Link href={`/anime/${s.anilistId}`} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.coverImage} alt="" className="h-16 w-11 rounded object-cover transition-opacity hover:opacity-80" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/anime/${s.anilistId}`} className="block truncate text-sm hover:underline">
                      {s.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted">
                      {s.episodesWatched} episode{s.episodesWatched === 1 ? "" : "s"} watched · last {relative(s.lastWatched).toLowerCase()}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <span className="tabular-nums">Ep {s.lastEpisode}</span>
                      <span className="h-[3px] w-28 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full bg-accent" style={{ width: `${s.lastProgressPct}%` }} />
                      </span>
                      {s.lastCompleted && <CircleCheck className="h-3.5 w-3.5 text-fg/60" />}
                    </div>
                  </div>
                  <Link href={`/watch/${s.anilistId}/${next}`} className="btn btn-ghost hidden !py-1.5 sm:inline-flex">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {s.lastCompleted ? `Ep ${next}` : "Resume"}
                  </Link>
                  <button
                    onClick={() => removeShow(s.anilistId, s.title)}
                    aria-label={`Remove ${s.title} from history`}
                    className="press rounded-lg p-2 text-muted opacity-60 transition hover:bg-white/[0.06] hover:text-fg group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {filteredShows.length === 0 && <li className="p-6 text-center text-sm text-muted">No shows match &ldquo;{query}&rdquo;.</li>}
        </ul>
      ) : (
        <div className="space-y-8">
          {groupedEvents.map((g) => (
            <section key={g.label}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{g.label}</h3>
              <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {g.items.map((e) => (
                  <li key={`${e.anilistId}-${e.episode}`}>
                    <Link href={`/watch/${e.anilistId}/${e.episode}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.coverImage} alt="" className="h-10 w-7 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{e.title}</div>
                        <div className="text-xs text-muted">Episode {e.episode}</div>
                      </div>
                      <span className="text-xs tabular-nums text-muted">{e.completed ? "Watched" : `${e.pct}%`}</span>
                      <span className="hidden w-16 text-right text-xs tabular-nums text-muted sm:block">
                        {new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groupedEvents.length === 0 && <p className="text-center text-sm text-muted">Nothing matches &ldquo;{query}&rdquo;.</p>}
        </div>
      )}
    </div>
  );
}
