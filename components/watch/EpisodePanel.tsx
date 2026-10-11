"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import type { EpisodeInfo, EpisodeProgress } from "../EpisodeGrid";
import { useLiveProgress } from "./useLiveProgress";

const MAX_SEGMENTS = 40;

export default function EpisodePanel({
  anilistId,
  episode,
  episodes,
  progress: initialProgress,
  synopsis,
}: {
  anilistId: number;
  episode: number;
  episodes: EpisodeInfo[];
  progress: EpisodeProgress;
  synopsis: string;
}) {
  const progress = useLiveProgress(anilistId, initialProgress);
  const [showSynopsis, setShowSynopsis] = useState(false);

  const idx = episodes.findIndex((e) => e.number === episode);
  const current = episodes[idx];
  const prev = idx > 0 ? episodes[idx - 1] : null;
  const next = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : null;
  const watched = episodes.filter((e) => progress[e.number]?.completed).length;
  const position = idx >= 0 ? idx + 1 : episode;

  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <span className="chip">EP {episode}</span>
        {progress[episode]?.completed && <span className="chip !border-success/30 !bg-success/10 !text-success">Watched</span>}
      </div>
      <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight">{current?.title ?? `Episode ${episode}`}</h2>

      {synopsis && (
        <div className="mt-4 rounded-xl bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <span className="label">Synopsis</span>
            <button onClick={() => setShowSynopsis((s) => !s)} className="flex items-center gap-1 font-mono text-[11px] text-muted transition-colors hover:text-fg">
              {showSynopsis ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showSynopsis ? "Hide" : "Show"}
            </button>
          </div>
          <p className={`mt-2 text-sm leading-relaxed ${showSynopsis ? "text-fg/75" : "select-none font-mono text-xs text-muted"}`}>
            {showSynopsis ? synopsis : "Hidden to avoid spoilers"}
          </p>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="label">Progress</span>
            <span className="font-mono text-[11px] text-muted tabular-nums">
              {position}/{episodes.length} · {watched} watched
            </span>
          </div>
          {episodes.length <= MAX_SEGMENTS ? (
            <div className="mt-2.5 flex gap-1">
              {episodes.map((e) => {
                const p = progress[e.number];
                const isCur = e.number === episode;
                return (
                  <Link
                    key={e.number}
                    href={`/watch/${anilistId}/${e.number}`}
                    title={`Episode ${e.number}${e.title ? ` · ${e.title}` : ""}`}
                    className={`h-2 flex-1 rounded-full transition-all hover:scale-y-150 ${
                      isCur ? "bg-accent" : p?.completed ? "bg-success" : p && p.pct > 0 ? "bg-success/40" : "bg-white/10 hover:bg-white/25"
                    }`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(watched / episodes.length) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <NavCard anilistId={anilistId} ep={prev} dir="prev" />
        <NavCard anilistId={anilistId} ep={next} dir="next" />
      </div>
    </div>
  );
}

function NavCard({ anilistId, ep, dir }: { anilistId: number; ep: EpisodeInfo | null; dir: "prev" | "next" }) {
  const isNext = dir === "next";
  if (!ep) {
    return (
      <div className={`flex items-center rounded-xl bg-white/[0.02] px-3 py-2.5 font-mono text-[11px] text-muted/60 ${isNext ? "justify-end" : ""}`}>
        {isNext ? "Last episode" : "First episode"}
      </div>
    );
  }
  return (
    <Link
      href={`/watch/${anilistId}/${ep.number}`}
      className={`group flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-2 transition-colors hover:bg-white/[0.07] ${isNext ? "flex-row-reverse text-right" : ""}`}
    >
      {isNext ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      ) : (
        <ChevronLeft className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-x-0.5" />
      )}
      {ep.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ep.thumbnail} alt="" className="hidden h-9 w-14 shrink-0 rounded-md object-cover sm:block" />
      )}
      <div className="min-w-0">
        <div className="label !text-[10px]">{isNext ? "Next" : "Previous"}</div>
        <div className="truncate font-mono text-xs">Episode {ep.number}</div>
      </div>
    </Link>
  );
}
