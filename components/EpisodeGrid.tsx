"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
  const startPage = current ? Math.floor((current - 1) / PAGE) : 0;
  const [page, setPage] = useState(startPage);
  const [filter, setFilter] = useState("");
  const inLibrary = useMemo(() => new Set(libraryEpisodes), [libraryEpisodes]);
  const pages = Math.ceil(episodes.length / PAGE);

  const shown = useMemo(() => {
    if (filter.trim()) {
      const f = filter.trim().toLowerCase();
      return episodes.filter((e) => String(e.number) === f || e.title?.toLowerCase().includes(f));
    }
    return episodes.slice(page * PAGE, page * PAGE + PAGE);
  }, [episodes, page, filter]);

  if (!episodes.length) {
    return <p className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">No episodes have aired yet.</p>;
  }

  const hasThumbs = !compact && episodes.some((e) => e.thumbnail);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {episodes.length > 12 && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find episode…"
            className="input !w-40 !py-1.5 text-sm"
          />
        )}
        {pages > 1 &&
          !filter &&
          Array.from({ length: pages }, (_, p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`chip transition ${p === page ? "!border-accent !text-fg" : "hover:!text-fg"}`}
            >
              {p * PAGE + 1}–{Math.min((p + 1) * PAGE, episodes.length)}
            </button>
          ))}
      </div>

      {hasThumbs ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => {
            const p = progress[e.number];
            return (
              <Link
                key={e.number}
                href={`/watch/${anilistId}/${e.number}`}
                className={`group flex gap-3 rounded-xl border bg-surface p-2 transition hover:border-accent/60 ${current === e.number ? "border-accent" : "border-line"}`}
              >
                <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {e.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.thumbnail} alt="" loading="lazy" className={`h-full w-full object-cover ${p?.completed ? "opacity-50" : ""}`} />
                  )}
                  {p && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                      <div className="h-full bg-accent" style={{ width: `${p.completed ? 100 : p.pct}%` }} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 py-1">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    Episode {e.number}
                    {p?.completed && <span className="text-accent">✓ Watched</span>}
                    {inLibrary.has(e.number) && <span className="rounded bg-emerald-500/15 px-1 text-emerald-400">Library</span>}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium group-hover:text-accent-2">{e.title ?? `Episode ${e.number}`}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={`grid gap-2 ${compact ? "grid-cols-5" : "grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12"}`}>
          {shown.map((e) => {
            const p = progress[e.number];
            const isCur = current === e.number;
            return (
              <Link
                key={e.number}
                href={`/watch/${anilistId}/${e.number}`}
                title={e.title ?? `Episode ${e.number}`}
                className={`relative grid h-10 place-items-center overflow-hidden rounded-lg border text-sm font-medium transition ${
                  isCur
                    ? "border-accent bg-accent text-white"
                    : p?.completed
                      ? "border-line bg-surface-2 text-muted"
                      : "border-line bg-surface hover:border-accent/60"
                }`}
              >
                {e.number}
                {inLibrary.has(e.number) && !isCur && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                {p && !p.completed && !isCur && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" style={{ width: `${p.pct}%` }} />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
