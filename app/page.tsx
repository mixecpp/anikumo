import Hero, { type HeroItem } from "@/components/Hero";
import ContinueWatching from "@/components/ContinueWatching";
import ErrorNotice from "@/components/ErrorNotice";
import GenreStrip from "@/components/GenreStrip";
import MediaGrid from "@/components/MediaGrid";
import RankedList from "@/components/RankedList";
import AiringToday, { type AiringItem } from "@/components/AiringToday";
import FinishStarted from "@/components/FinishStarted";
import Reveal from "@/components/Reveal";
import { getHomeData, getSchedule, prettyEnum, stripHtml, type MediaCard } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { getContinueWatching } from "@/lib/progress";
import { arrangeContinue, becauseYouWatched, unfinished } from "@/lib/home-personal";
import { getUi } from "@/lib/server-i18n";
import { pickTitle } from "@/lib/prefs-shared";

export const dynamic = "force-dynamic";

async function airingToday(lang: Parameters<typeof pickTitle>[1]): Promise<AiringItem[]> {
  // Rolling window (last 2h → next 24h), bucketed to 15 min so the schedule cache stays warm.
  const now = Math.floor(Date.now() / 1000 / 900) * 900;
  const items = await getSchedule(now - 2 * 3600, now + 24 * 3600).catch(() => []);
  return items.map((s) => ({ id: s.id, anilistId: s.media.id, airingAt: s.airingAt, episode: s.episode, title: pickTitle(s.media.title, lang), cover: s.media.coverImage.large }));
}

export default async function Home() {
  const [userId, ui] = await Promise.all([getUserId(), getUi()]);
  const { t, prefs } = ui;
  const noEcchi = (list: MediaCard[]) => (prefs.hideEcchi ? list.filter((m) => !m.genres.includes("Ecchi")) : list);

  const [data, cont, airing, because, unfinishedShows] = await Promise.all([
    getHomeData().catch((e: Error) => e),
    userId ? getContinueWatching(userId).then((c) => arrangeContinue(userId, c)) : Promise.resolve([]),
    airingToday(prefs.titleLang),
    userId ? becauseYouWatched(userId, prefs.hideEcchi).catch(() => []) : Promise.resolve([]),
    userId ? unfinished(userId).catch(() => []) : Promise.resolve([]),
  ]);

  if (data instanceof Error) return <ErrorNotice message={data.message} />;

  const hero: HeroItem[] = noEcchi(data.trending.media)
    .filter((m) => m.bannerImage)
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      title: ui.title(m.title),
      banner: m.bannerImage!,
      cover: m.coverImage.extraLarge,
      description: stripHtml(m.description),
      color: m.coverImage.color,
      score: m.averageScore ? m.averageScore / 10 : null,
      meta: [prettyEnum(m.format), m.seasonYear ? String(m.seasonYear) : "", ...m.genres.slice(0, 2)].filter(Boolean),
    }));

  const hasContinue = cont.length > 0;
  const trending = noEcchi(data.trending.media);

  return (
    <div>
      <Hero items={hero} />
      <div className="mx-auto max-w-[1400px] space-y-16 px-4 md:px-8">
        <GenreStrip />

        <Reveal>
          <div className="grid gap-x-8 gap-y-12 lg:grid-cols-[minmax(0,1fr)_360px]">
            {hasContinue ? <ContinueWatching items={cont} /> : <MediaGrid title={t("home.trending")} items={trending} href="/browse?sort=trending" limit={8} ranked narrow />}
            <AiringToday items={airing} />
          </div>
        </Reveal>

        {because.map((row) => (
          <MediaGrid key={row.seedId} title={`${t("home.because")} ${row.seedTitle}`} items={row.items} limit={6} />
        ))}

        <FinishStarted items={unfinishedShows} title={t("home.finish")} />

        {hasContinue && <MediaGrid title={t("home.trending")} items={trending} href="/browse?sort=trending" ranked />}
        <MediaGrid title={t("home.season")} items={noEcchi(data.seasonal.media)} href="/season" />

        <div className="grid gap-x-8 gap-y-12 lg:grid-cols-2">
          <RankedList title={t("home.top")} items={noEcchi(data.top.media)} href="/charts" />
          <RankedList title={t("home.popular")} items={noEcchi(data.popular.media)} href="/browse?sort=popularity" />
        </div>
      </div>
    </div>
  );
}
