import type { Metadata } from "next";
import { browse } from "@/lib/anilist";
import { parseBrowseParams, SEASONS, VIBES, browseQuery } from "@/lib/browse-params";
import { getUserId } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";
import { prisma } from "@/lib/db";
import { translator } from "@/lib/i18n";
import BrowseView from "@/components/browse/BrowseView";

export const metadata: Metadata = { title: "Browse", description: "Filter anime by genre, tags, length, score, season and more." };

type SP = Record<string, string | string[] | undefined>;

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = parseBrowseParams(await searchParams);
  const [prefs, userId] = await Promise.all([getPrefs(), getUserId()]);
  const hideEcchi = prefs.hideEcchi && !params.genres?.includes("Ecchi");
  const query = { ...params, page: 1, excludeGenres: hideEcchi ? [...new Set([...(params.excludeGenres ?? []), "Ecchi"])] : params.excludeGenres };

  const [result, presets] = await Promise.all([
    browse(query).then(
      (data) => ({ data, error: undefined }),
      (e: Error) => ({ data: null, error: e.message }),
    ),
    userId ? prisma.browsePreset.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, query: true } }) : [],
  ]);

  const t = translator(prefs.locale);
  const vibe = VIBES.find((v) => browseQuery(v.params as typeof params) === browseQuery(params));
  const seasonLabel = SEASONS.find(([k]) => k === params.season)?.[1];
  const heading = params.q
    ? `Results for “${params.q}”`
    : vibe
      ? vibe.label
      : params.maxPopularity
        ? "Hidden gems"
        : params.genres?.length === 1 && !params.season
          ? params.genres[0]
          : seasonLabel && params.year
            ? `${seasonLabel} ${params.year}`
            : t("browse.title");

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{heading}</h1>
      {vibe && <p className="mt-1.5 text-sm text-muted">{vibe.hint}</p>}
      <div className="mt-8">
        <BrowseView params={params} initial={result.data} error={result.error} presets={presets} hiddenEcchi={hideEcchi && !!prefs.hideEcchi} />
      </div>
    </div>
  );
}
