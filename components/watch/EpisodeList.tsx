"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ChevronRight, Crosshair, EyeOff, Search } from "lucide-react";
import type { EpisodeInfo, EpisodeProgress } from "../EpisodeGrid";
import { useLiveProgress } from "./useLiveProgress";

/** Accepts "12", "5-10", "5–10" or free text matched against episode titles. */
function matcher(raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const range = q.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y);
    return (e: EpisodeInfo) => e.number >= a && e.number <= b;
  }
  if (/^\d+$/.test(q)) return (e: EpisodeInfo) => String(e.number).startsWith(q);
  return (e: EpisodeInfo) => !!e.title?.toLowerCase().includes(q);
}

function NowPlaying() {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-label="Now playing">
      {[0.6, 1, 0.75].map((h, i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-sm bg-accent"
          style={{ height: `${h * 100}%`, animation: `eq 0.9s ease-in-out ${i * 0.15}s infinite alternate` }}
        />
      ))}
    </span>
  );
}

export default function EpisodeList({
  anilistId,
  episodes,
  progress: initialProgress,
  current,
}: {
  anilistId: number;
  episodes: EpisodeInfo[];
  progress: EpisodeProgress;
  current: number;
}) {
  const progress = useLiveProgress(anilistId, initialProgress);
  const [query, setQuery] = useState("");
  const [desc, setDesc] = useState(false);
  const [hideWatched, setHideWatched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const match = matcher(query);
    let list = match ? episodes.filter(match) : episodes;
    if (hideWatched) list = list.filter((e) => !progress[e.number]?.completed || e.number === current);
    return desc ? [...list].reverse() : list;
  }, [episodes, query, desc, hideWatched, progress, current]);

  const watched = episodes.filter((e) => progress[e.number]?.completed).length;

  function scrollToCurrent(behavior: ScrollBehavior = "smooth") {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-ep="${current}"]`);
    if (list && el) list.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior });
  }
  useEffect(() => scrollToCurrent("auto"), []); // eslint-disable-line react-hooks/exhaustive-deps

  const iconBtn = (active: boolean) =>
    `press grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-white/[0.12] text-fg" : "bg-white/[0.04] text-muted hover:bg-white/[0.08] hover:text-fg"}`;

  return (
    <div className="panel overflow-hidden rounded-2xl">
      <div className="space-y-3 p-3">
        <div className="flex gap-1.5">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Episode or range, e.g. 5-10" className="input !py-2 !pl-9 font-mono !text-xs" aria-label="Find episode" />
          </label>
          <button onClick={() => scrollToCurrent()} className={iconBtn(false)} title="Jump to current episode" aria-label="Jump to current episode">
            <Crosshair className="h-4 w-4" />
          </button>
          <button onClick={() => setDesc((d) => !d)} className={iconBtn(desc)} title={desc ? "Newest first" : "Oldest first"} aria-label="Reverse order" aria-pressed={desc}>
            <ArrowDownUp className="h-4 w-4" />
          </button>
          <button onClick={() => setHideWatched((h) => !h)} className={iconBtn(hideWatched)} title="Hide watched" aria-label="Hide watched" aria-pressed={hideWatched}>
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${episodes.length ? (watched / episodes.length) * 100 : 0}%` }} />
          </div>
          <span className="font-mono text-[11px] text-muted tabular-nums">
            {watched}/{episodes.length} watched
          </span>
        </div>
      </div>

      <div ref={listRef} className="thin-scroll relative max-h-[min(70vh,720px)] space-y-1.5 overflow-y-auto px-3 pb-3 pt-1">
        {shown.map((e) => {
          const p = progress[e.number];
          const isCur = e.number === current;
          return (
            <Link
              key={e.number}
              data-ep={e.number}
              href={`/watch/${anilistId}/${e.number}`}
              aria-current={isCur ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl border p-2 transition-colors [contain-intrinsic-size:76px] [content-visibility:auto] ${
                isCur
                  ? "border-accent/50 bg-accent/[0.07]"
                  : p?.completed
                    ? "border-success/25 hover:border-success/40 hover:bg-white/[0.03]"
                    : "border-transparent hover:bg-white/[0.04]"
              }`}
            >
              <div className="relative aspect-video w-[104px] shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                {e.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.thumbnail} alt="" loading="lazy" className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${p?.completed && !isCur ? "opacity-60" : ""}`} />
                ) : (
                  <span className="grid h-full place-items-center font-mono text-lg text-muted/70">{e.number}</span>
                )}
                <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-px font-mono text-[10px] font-medium">EP {e.number}</span>
                {p && !p.completed && p.pct > 0 && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/50">
                    <span className="block h-full bg-accent" style={{ width: `${p.pct}%` }} />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-mono text-sm">
                  Episode {e.number}
                  {isCur && <NowPlaying />}
                </div>
                {e.title && <div className="mt-0.5 line-clamp-1 text-xs text-fg/60">{e.title}</div>}
                <div className="mt-1 font-mono text-[11px]">
                  {isCur ? (
                    <span className="text-accent">Now playing</span>
                  ) : p?.completed ? (
                    <span className="text-success">Watched</span>
                  ) : p && p.pct > 0 ? (
                    <span className="text-muted">{p.pct}% watched</span>
                  ) : null}
                </div>
              </div>
              <ChevronRight className={`h-4 w-4 shrink-0 transition ${isCur ? "text-accent" : "text-muted/50 group-hover:translate-x-0.5 group-hover:text-fg"}`} />
            </Link>
          );
        })}
        {shown.length === 0 && <p className="py-8 text-center font-mono text-xs text-muted">No episodes match.</p>}
      </div>
    </div>
  );
}
