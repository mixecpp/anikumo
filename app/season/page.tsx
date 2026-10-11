import Link from "next/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentSeason, getSeason, shiftSeason, SEASON_ORDER } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { statusMap } from "@/lib/list";
import { getSeasonPoll } from "@/lib/polls";
import ErrorNotice from "@/components/ErrorNotice";
import SeasonChart from "@/components/season/SeasonChart";
import PollCard from "@/components/season/PollCard";

export const metadata: Metadata = pageMeta({ title: "Seasonal anime chart", description: "Every anime airing this season with air dates, studios and scores, plus next season's premieres.", path: "/season" });

type SP = Record<string, string | undefined>;

const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function SeasonPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = currentSeason();
  const season = SEASON_ORDER.includes(sp.season?.toUpperCase() as (typeof SEASON_ORDER)[number]) ? sp.season!.toUpperCase() : now.season;
  const yearNum = Number(sp.year);
  const year = Number.isInteger(yearNum) && yearNum > 1960 && yearNum <= now.year + 2 ? yearNum : now.year;

  const prev = shiftSeason(season, year, -1);
  const next = shiftSeason(season, year, 1);
  const upNext = shiftSeason(now.season, now.year, 1);
  const isCurrent = season === now.season && year === now.year;
  const isUpcoming = season === upNext.season && year === upNext.year;

  const userId = await getUserId();
  const [media, statuses, poll] = await Promise.all([
    getSeason(season, year).catch((e: Error) => e),
    statusMap(userId),
    isCurrent || (year === now.year && SEASON_ORDER.indexOf(season as (typeof SEASON_ORDER)[number]) < SEASON_ORDER.indexOf(now.season as (typeof SEASON_ORDER)[number])) ? getSeasonPoll(season, year, userId).catch(() => null) : Promise.resolve(null),
  ]);
  if (media instanceof Error) return <ErrorNotice message={media.message} />;

  const href = (s: { season: string; year: number }) => `/season?season=${s.season}&year=${s.year}`;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">{isCurrent ? "Airing now" : isUpcoming ? "Coming soon" : "Seasonal chart"}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {label(season)} {year}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{media.length} titles</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={href(prev)} className="btn btn-ghost btn-icon" aria-label={`${label(prev.season)} ${prev.year}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {!isCurrent && (
            <Link href="/season" className="btn btn-ghost !py-2">
              This season
            </Link>
          )}
          {!isUpcoming && (
            <Link href={href(upNext)} className="btn btn-ghost !py-2">
              Upcoming
            </Link>
          )}
          <Link href={href(next)} className="btn btn-ghost btn-icon" aria-label={`${label(next.season)} ${next.year}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className={`mt-8 grid gap-8 ${poll ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <SeasonChart media={media} statuses={statuses} upcoming={isUpcoming || media.every((m) => m.status === "NOT_YET_RELEASED")} />
        {poll && (
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <PollCard poll={poll} />
          </aside>
        )}
      </div>
    </div>
  );
}
