"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Play, Search } from "lucide-react";

export type EpisodeInfo = { number: number; title: string | null; thumbnail: string | null };
export type EpisodeProgress = Record<number, { pct: number; completed: boolean }>;

const PAGE = 100;

export default function EpisodeGrid({
  anilistId,
  episodes,
  progress,
  libraryEpisodes,
  current,
  compact,
}: {
  anilistId: number;
  episodes: EpisodeInfo[];
  progress: EpisodeProgress;
  libraryEpisodes: number[];
  current?: number;
  compact?: boolean;
}) {
  const [page, setPage] = useState(current ? Math.floor((current - 1) / PAGE) : 0);
  const [filter, setFilter] = useState("");
  const [liveProgress, setLiveProgress] = useState(progress);
  useEffect(() => setLiveProgress(progress), [progress]);
  useEffect(() => {
    const onProgress = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d?.anilistId !== anilistId || !Number.isSafeInteger(d.episode)) return;
      setLiveProgress((previous) => ({ ...previous, [d.episode]: { pct: Math.min(100, Math.max(0, d.pct)), completed: d.completed === true } }));
    };
    window.addEventListener("anikumo:progress", onProgress);
    return () => window.removeEventListener("anikumo:progress", onProgress);
  }, [anilistId]);
  const inLibrary = useMemo(() => new Set(libraryEpisodes), [libraryEpisodes]);
  const pages = Math.ceil(episodes.length / PAGE);

  const shown = useMemo(() => {
    if (filter.trim()) {
      const f = filter.trim().toLowerCase();
      const range = f.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (range) return episodes.filter((e) => e.number >= Number(range[1]) && e.number <= Number(range[2]));
      return episodes.filter((e) => String(e.number) === f || e.title?.toLowerCase().includes(f));
    }
    return episodes.slice(page * PAGE, page * PAGE + PAGE);
  }, [episodes, page, filter]);

  if (!episodes.length) {
    return <p className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center text-sm text-muted">No episodes available yet.</p>;
  }

  const hasThumbs = !compact && episodes.some((e) => e.thumbnail);
  const watched = episodes.filter((e) => liveProgress[e.number]?.completed).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {episodes.length > 12 && (
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Episode or range, e.g. 5-10" className="input !w-60 !py-1.5 !pl-8 font-mono !text-xs" />
          </label>
        )}
        {pages > 1 &&
          !filter &&
          Array.from({ length: pages }, (_, p) => (
            <button key={p} onClick={() => setPage(p)} className={`chip press ${p === page ? "!bg-fg !text-bg" : ""}`}>
              {p * PAGE + 1}–{Math.min((p + 1) * PAGE, episodes.length)}
            </button>
          ))}
        {watched > 0 && (
          <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">
            {watched}/{episodes.length} watched
          </span>
        )}
      </div>

      {hasThumbs ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((e) => {
            const p = liveProgress[e.number];
            const isCur = current === e.number;
            return (
              <Link key={e.number} href={`/watch/${anilistId}/${e.number}`} className="group block">
                <div
                  className={`relative aspect-video overflow-hidden rounded-xl bg-white/[0.05] ring-1 ring-inset transition ${
                    isCur ? "ring-accent/70" : p?.completed ? "ring-success/40" : "ring-white/[0.06] group-hover:ring-white/20"
                  }`}
                >
                  {e.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.thumbnail} alt="" loading="lazy" className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] ${p?.completed ? "opacity-60" : ""}`} />
                  )}
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1.5 py-px font-mono text-[10px] font-medium">EP {e.number}</span>
                  {p?.completed && (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-success text-bg">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition duration-300 group-hover:opacity-100">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-bg">
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    </span>
                  </span>
                  {p && !p.completed && p.pct > 0 && (
                    <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/50">
                      <span className="block h-full bg-accent" style={{ width: `${p.pct}%` }} />
                    </span>
                  )}
                </div>
                <div className="mt-2 line-clamp-1 text-sm text-fg/90">{e.title ?? `Episode ${e.number}`}</div>
                {inLibrary.has(e.number) && <div className="font-mono text-[11px] text-muted">In library</div>}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={`grid gap-1.5 ${compact ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12"}`}>
          {shown.map((e) => {
            const p = liveProgress[e.number];
            const isCur = current === e.number;
            return (
              <Link
                key={e.number}
                href={`/watch/${anilistId}/${e.number}`}
                title={e.title ?? `Episode ${e.number}`}
                className={`press relative grid h-10 place-items-center overflow-hidden rounded-lg border font-mono text-sm transition-colors ${
                  isCur
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : p?.completed
                      ? "border-success/30 bg-success/[0.06] text-success"
                      : "border-white/[0.06] bg-white/[0.03] text-fg/80 hover:border-white/20 hover:text-fg"
                }`}
              >
                {e.number}
                {p && !p.completed && !isCur && p.pct > 0 && <span className="absolute bottom-0 left-0 h-0.5 bg-accent" style={{ width: `${p.pct}%` }} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
