import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getMedia, prettyEnum, stripHtml, titleOf } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildEpisodes, getEpisodeProgress, getLibraryEpisodes } from "@/lib/episodes";
import WatchClient from "@/components/WatchClient";
import Comments from "@/components/Comments";
import Row from "@/components/Row";
import SetAmbient from "@/components/SetAmbient";
import EpisodePanel from "@/components/watch/EpisodePanel";
import EpisodeList from "@/components/watch/EpisodeList";
import Reactions from "@/components/watch/Reactions";
import RewatchTracker from "@/components/watch/RewatchTracker";
import { getUi } from "@/lib/server-i18n";
import { sourceSetup } from "@/lib/providers";
import { getAniweebEpisodes, getPlaybackSettings, resolvePlaybackSource } from "@/lib/playback/server";

type Props = { params: Promise<{ id: string; ep: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, ep } = await params;
  const m = await getMedia(Number(id)).catch(() => null);
  return { title: m ? `${titleOf(m)} · Episode ${ep}` : "Watch", robots: { index: false, follow: true } };
}

export default async function WatchPage({ params }: Props) {
  const { id: idStr, ep: epStr } = await params;
  const id = Number(idStr);
  const ep = Number(epStr);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(ep) || ep < 1) notFound();

  const [m, userId] = await Promise.all([getMedia(id), getUserId()]);
  if (!m) notFound();

  const [progress, libraryEps, row, source, settings, remoteEpisodes] = await Promise.all([
    getEpisodeProgress(userId, id),
    getLibraryEpisodes(id),
    userId
      ? prisma.watchProgress.findUnique({ where: { userId_anilistId_episode: { userId, anilistId: id, episode: ep } } })
      : null,
    resolvePlaybackSource(id, ep),
    getPlaybackSettings(userId),
    getAniweebEpisodes(id),
  ]);

  const episodes = remoteEpisodes.length ? remoteEpisodes : buildEpisodes(m, libraryEps);
  const [ui, rewatching] = await Promise.all([
    getUi(),
    userId ? prisma.listEntry.findUnique({ where: { userId_anilistId: { userId, anilistId: id } }, select: { rewatching: true } }).then((e) => !!e?.rewatching) : false,
  ]);
  const title = ui.title(m.title);
  const recs = m.recommendations.nodes.map((n) => n.mediaRecommendation).filter((x) => x !== null);
  const chips = [
    prettyEnum(m.format),
    m.seasonYear ? String(m.seasonYear) : null,
    episodes.length ? `${m.episodes ?? episodes.length} eps` : null,
  ].filter((x): x is string => !!x);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-5 md:px-8">
      <SetAmbient images={[m.bannerImage ?? m.coverImage.extraLarge]} />

      <header className="mb-5 flex items-center gap-4">
        <Link href={`/anime/${id}`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.bannerImage ?? m.coverImage.large} alt="" className="h-12 w-20 rounded-lg object-cover ring-1 ring-white/10 transition-opacity hover:opacity-80" />
        </Link>
        <div className="min-w-0">
          <Link href={`/anime/${id}`} className="block truncate text-base font-semibold tracking-tight hover:underline md:text-lg">
            {title}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
            {m.averageScore != null && (
              <span className="chip">
                <Star className="h-3 w-3 fill-star text-star" />
                {(m.averageScore / 10).toFixed(1)}
              </span>
            )}
            {m.genres.slice(0, 3).map((g) => (
              <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} className="chip hidden sm:inline-flex">
                {g}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <WatchClient
            anilistId={id}
            episode={ep}
            idMal={m.idMal}
            title={title}
            coverImage={m.coverImage.large}
            resumeAt={row?.progressSeconds ?? 0}
            completed={row?.completed ?? false}
            hasNext={episodes.some((e) => e.number > ep)}
            nextEpisode={episodes.find((e) => e.number > ep)?.number ?? null}
            hasPrev={ep > 1}
            userId={userId}
            embedsEnabled={sourceSetup().embeds}
            source={source}
            initialSettings={settings}
          />
        </div>

        <aside className="space-y-5 xl:row-span-2">
          <EpisodePanel anilistId={id} episode={ep} episodes={episodes} progress={progress} synopsis={stripHtml(m.description)} />
          <div>
            <h2 className="mb-3 text-sm font-semibold">Episodes</h2>
            <EpisodeList anilistId={id} episodes={episodes} progress={progress} current={ep} />
          </div>
        </aside>

        <div className="min-w-0 space-y-12">
          {recs.length > 0 && (
            <div className="-mx-4 md:-mx-8">
              <Row title="Recommended" items={recs} />
            </div>
          )}
          <Reactions anilistId={id} episode={ep} />
          <RewatchTracker anilistId={id} active={rewatching} />
          <Comments anilistId={id} episode={ep} loggedIn={!!userId} />
        </div>
      </div>
    </div>
  );
}
