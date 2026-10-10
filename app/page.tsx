import Hero, { type HeroItem } from "@/components/Hero";
import Row from "@/components/Row";
import ContinueWatching from "@/components/ContinueWatching";
import ErrorNotice from "@/components/ErrorNotice";
import { getHomeData, prettyEnum, stripHtml, titleOf } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { getContinueWatching } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await getUserId();
  const [data, cont] = await Promise.all([
    getHomeData().catch((e: Error) => e),
    userId ? getContinueWatching(userId) : Promise.resolve([]),
  ]);

  if (data instanceof Error) return <ErrorNotice message={data.message} />;

  const hero: HeroItem[] = data.trending.media
    .filter((m) => m.bannerImage)
    .slice(0, 6)
    .map((m) => ({
      id: m.id,
      title: titleOf(m),
      banner: m.bannerImage!,
      cover: m.coverImage.extraLarge,
      description: stripHtml(m.description),
      color: m.coverImage.color,
      meta: [
        prettyEnum(m.format),
        m.seasonYear ? String(m.seasonYear) : "",
        m.averageScore ? `★ ${(m.averageScore / 10).toFixed(1)}` : "",
        ...m.genres.slice(0, 3),
      ].filter(Boolean),
    }));

  return (
    <div>
      <Hero items={hero} />
      <div className="mx-auto max-w-[1500px]">
        <ContinueWatching items={cont} />
        <Row title="Trending now" items={data.trending.media} href="/browse?sort=trending" ranked />
        <Row title="Popular this season" items={data.seasonal.media} href="/browse?season=current" />
        <Row title="All-time popular" items={data.popular.media} href="/browse?sort=popularity" />
        <Row title="Top rated" items={data.top.media} href="/browse?sort=score" />
      </div>
    </div>
  );
}
