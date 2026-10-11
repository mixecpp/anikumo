"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Star } from "lucide-react";
import type { SeasonMedia } from "@/lib/anilist";
import type { ListStatus } from "@/lib/list-shared";
import QuickStatus from "../list/QuickStatus";
import Countdown from "../Countdown";
import Select from "../Select";
import { useTitle } from "../PrefsProvider";
import FadeRow from "../FadeRow";

const GROUPS: { key: string; label: string; formats: string[] }[] = [
  { key: "tv", label: "TV", formats: ["TV"] },
  { key: "short", label: "TV Short", formats: ["TV_SHORT"] },
  { key: "movie", label: "Movies", formats: ["MOVIE"] },
  { key: "ona", label: "ONA", formats: ["ONA"] },
  { key: "other", label: "OVA & Specials", formats: ["OVA", "SPECIAL", "MUSIC"] },
];

const SORTS = [
  { value: "popularity", label: "Popularity" },
  { value: "score", label: "Score" },
  { value: "start", label: "Start date" },
  { value: "title", label: "Title" },
];

function startTs(m: SeasonMedia) {
  const d = m.startDate;
  return d.year ? new Date(d.year, (d.month ?? 1) - 1, d.day ?? 1).getTime() : Number.MAX_SAFE_INTEGER;
}

export default function SeasonChart({ media, statuses, upcoming }: { media: SeasonMedia[]; statuses: Record<number, ListStatus>; upcoming: boolean }) {
  const title = useTitle();
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState(upcoming ? "start" : "popularity");
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.key, media.filter((m) => g.formats.includes(m.format ?? "")).length])), [media]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const g = GROUPS.find((x) => x.key === group);
    const list = media.filter(
      (m) => (!g || g.formats.includes(m.format ?? "")) && (!q || title(m.title).toLowerCase().includes(q)) && (!mineOnly || statuses[m.id]),
    );
    return [...list].sort((a, b) =>
      sort === "score" ? (b.averageScore ?? 0) - (a.averageScore ?? 0) : sort === "start" ? startTs(a) - startTs(b) : sort === "title" ? title(a.title).localeCompare(title(b.title)) : 0,
    );
  }, [media, group, sort, query, mineOnly, statuses, title]);

  const tabs = [{ key: "all", label: "All", count: media.length }, ...GROUPS.map((g) => ({ ...g, count: counts[g.key] })).filter((g) => g.count > 0)];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <FadeRow className="scrollbar-none flex gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setGroup(t.key)} className={`relative shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${group === t.key ? "text-fg" : "text-muted hover:text-fg"}`}>
              {group === t.key && <motion.span layoutId="season-group" className="absolute inset-0 rounded-lg bg-white/[0.09]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">
                {t.label} <span className="font-mono text-[11px] text-muted">{t.count}</span>
              </span>
            </button>
          ))}
        </FadeRow>
        <label className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter season" className="input !py-2 !pl-9 text-sm" aria-label="Filter season" />
        </label>
        <Select label="Sort" value={sort} onChange={setSort} options={SORTS} className="w-40" align="right" />
        {Object.keys(statuses).length > 0 && (
          <button
            onClick={() => setMineOnly((v) => !v)}
            aria-pressed={mineOnly}
            className={`press rounded-full px-3 py-1.5 text-xs transition-colors ${mineOnly ? "bg-fg text-bg" : "bg-white/[0.06] text-fg/75 hover:text-fg"}`}
          >
            On my list
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">Nothing matches.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((m, i) => {
            const start = startTs(m);
            const notStarted = m.status === "NOT_YET_RELEASED";
            return (
              <motion.article
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 20) * 0.015 }}
                className="panel group flex gap-4 rounded-2xl p-3 transition-colors hover:border-white/15"
              >
                <Link href={`/anime/${m.id}`} className="relative w-24 shrink-0 overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.coverImage.large} alt="" loading="lazy" className="aspect-[2/3] h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                  {statuses[m.id] && <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" title="On your list" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/anime/${m.id}`} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
                    {title(m.title)}
                  </Link>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">
                    {[m.studios.nodes[0]?.name, m.episodes ? `${m.episodes} eps` : null].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.genres.slice(0, 3).map((g) => (
                      <span key={g} className="chip !py-0 !text-[10px]">
                        {g}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <div className="whitespace-nowrap font-mono text-[11px]">
                      {notStarted && start !== Number.MAX_SAFE_INTEGER ? (
                        <span className="text-accent">
                          Premieres <Countdown to={start} fallback={new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                        </span>
                      ) : m.nextAiringEpisode ? (
                        <span className="text-muted">
                          EP {m.nextAiringEpisode.episode} <Countdown to={m.nextAiringEpisode.airingAt * 1000} />
                        </span>
                      ) : m.averageScore ? (
                        <span className="flex items-center gap-1 text-fg/80">
                          <Star className="h-3 w-3 fill-star text-star" />
                          {(m.averageScore / 10).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <QuickStatus anilistId={m.id} title={title(m.title)} coverImage={m.coverImage.large} initial={statuses[m.id] ?? null} align="right" />
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
