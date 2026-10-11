import Link from "next/link";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getTopChart, prettyEnum } from "@/lib/anilist";
import { GENRE_LIST } from "@/lib/browse-params";
import { getUi } from "@/lib/server-i18n";
import { getUserId } from "@/lib/auth";
import { statusMap } from "@/lib/list";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/list-shared";
import ErrorNotice from "@/components/ErrorNotice";
import ChartFilters from "@/components/charts/ChartFilters";

export const metadata: Metadata = { title: "Charts", description: "The 100 highest rated anime of all time, by genre and year, plus hidden gems." };

type SP = Record<string, string | undefined>;

export default async function ChartsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const type = sp.type === "gems" ? "gems" : "top";
  const genre = GENRE_LIST.find((g) => g === sp.genre);
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y >= 1970 && y <= new Date().getFullYear() ? y : undefined;

  const [{ title }, userId] = await Promise.all([getUi(), getUserId()]);
  const [media, statuses] = await Promise.all([getTopChart({ genre, year, gems: type === "gems" }).catch((e: Error) => e), statusMap(userId)]);
  if (media instanceof Error) return <ErrorNotice message={media.message} />;

  const heading = type === "gems" ? "Hidden gems" : `Top ${media.length}`;
  const sub = [genre, year].filter(Boolean).join(" · ") || (type === "gems" ? "Highly rated, rarely talked about" : "Highest rated of all time");

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{heading}</h1>
      <p className="mt-1.5 text-sm text-muted">{sub}</p>
      <div className="mt-6">
        <ChartFilters type={type} genre={genre} year={year} />
      </div>

      {media.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">Nothing here yet.</p>
      ) : (
        <ol className="mt-8 grid gap-x-8 lg:grid-cols-2">
          {media.map((m, i) => {
            const s = statuses[m.id];
            return (
              <li key={m.id} className="border-b border-white/[0.05]">
                <Link href={`/anime/${m.id}`} className="group flex items-center gap-4 py-3 transition-colors hover:bg-white/[0.02]">
                  <span className={`w-8 shrink-0 text-right font-mono text-sm tabular-nums ${i < 3 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.coverImage.large} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm group-hover:underline">{title(m.title)}</div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                      {[prettyEnum(m.format), m.seasonYear, m.episodes ? `${m.episodes} eps` : null, m.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                    </div>
                    {s && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`} />
                        {STATUS_LABEL[s]}
                      </div>
                    )}
                  </div>
                  {m.averageScore != null && (
                    <span className="flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-star text-star" />
                      {(m.averageScore / 10).toFixed(1)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
