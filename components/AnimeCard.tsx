import Link from "next/link";
import { prettyEnum, titleOf, type MediaCard } from "@/lib/anilist";

export default function AnimeCard({ m, rank }: { m: MediaCard; rank?: number }) {
  const eps = m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : m.episodes;
  return (
    <Link href={`/anime/${m.id}`} className="group block w-full">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.coverImage.large}
          alt={titleOf(m)}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-hover:brightness-75"
        />
        {rank !== undefined && (
          <span className="absolute left-0 top-0 rounded-br-xl bg-accent px-2.5 py-1 font-[family-name:var(--font-display)] text-sm font-extrabold text-white">
            #{rank}
          </span>
        )}
        {m.averageScore != null && (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold backdrop-blur">
            ★ {(m.averageScore / 10).toFixed(1)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8 text-[11px] font-medium">
          {m.format && <span className="rounded bg-white/15 px-1.5 py-0.5 backdrop-blur">{prettyEnum(m.format)}</span>}
          {eps ? <span className="rounded bg-white/15 px-1.5 py-0.5 backdrop-blur">{eps} ep</span> : null}
          {m.status === "RELEASING" && <span className="rounded bg-accent/90 px-1.5 py-0.5">Airing</span>}
        </div>
        <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-accent shadow-lg shadow-accent/40">
            <svg className="ml-0.5 h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>
      </div>
      <div className="mt-2 line-clamp-2 text-sm font-medium leading-snug transition group-hover:text-accent-2">{titleOf(m)}</div>
      <div className="mt-0.5 text-xs text-muted">
        {[m.seasonYear, m.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
      </div>
    </Link>
  );
}
