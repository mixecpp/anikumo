"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { prettyEnum, type MediaCard } from "@/lib/anilist";
import { pickTitle } from "@/lib/prefs-shared";
import { usePrefs } from "./PrefsProvider";

export default function AnimeCard({ m, rank }: { m: MediaCard; rank?: number }) {
  const { prefs } = usePrefs();
  const title = pickTitle(m.title, prefs.titleLang);
  const blur = prefs.blurEcchi && m.genres.includes("Ecchi");
  const eps = m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : m.episodes;
  return (
    <Link href={`/anime/${m.id}`} className="group block w-full">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl" style={{ background: m.coverImage.color ? `${m.coverImage.color}33` : undefined }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.coverImage.large}
          alt={title}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] ${blur ? "blur-xl group-hover:blur-0" : ""}`}
        />
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.06] transition group-hover:ring-white/20" />
        {rank !== undefined && (
          <span className="absolute left-0 top-0 rounded-br-lg bg-bg/80 px-2 py-1 text-xs font-semibold tabular-nums backdrop-blur-md">{rank}</span>
        )}
        {m.status === "RELEASING" && (
          <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-bg/75 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Airing
          </span>
        )}
      </div>
      <div className="mt-2.5 line-clamp-1 text-sm font-medium text-fg/90 transition-colors group-hover:text-fg">{title}</div>
      <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted">
        {m.averageScore != null && (
          <span className="flex shrink-0 items-center gap-0.5">
            <Star className="h-3 w-3 fill-star text-star" />
            {(m.averageScore / 10).toFixed(1)}
            <span className="ml-1">·</span>
          </span>
        )}
        <span className="truncate">{[prettyEnum(m.format), m.seasonYear, eps ? `${eps} ep` : null].filter(Boolean).join(" · ")}</span>
      </div>
    </Link>
  );
}
