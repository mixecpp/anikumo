import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import ErrorNotice from "@/components/ErrorNotice";
import ScheduleView from "@/components/ScheduleView";
import { getSchedule, titleOf } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = pageMeta({ title: "Anime airing schedule", description: "When new episodes air this week, in your time zone, with countdowns for every show.", path: "/schedule" });
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  const from = Math.floor(start.getTime() / 1000);
  const to = from + 8 * 86400;

  const userId = await getUserId();
  const [data, favs, watching] = await Promise.all([
    getSchedule(from, to).catch((e: Error) => e),
    userId ? prisma.favorite.findMany({ where: { userId }, select: { anilistId: true } }) : [],
    userId ? prisma.watchProgress.findMany({ where: { userId }, select: { anilistId: true }, distinct: ["anilistId"] }) : [],
  ]);
  if (data instanceof Error) return <ErrorNotice message={data.message} />;

  const mine = [...new Set([...favs, ...watching].map((r) => r.anilistId))];
  const items = data.map((s) => ({
    id: s.id,
    anilistId: s.media.id,
    airingAt: s.airingAt,
    episode: s.episode,
    title: titleOf(s.media),
    cover: s.media.coverImage.large,
    format: s.media.format,
    total: s.media.episodes,
    score: s.media.averageScore,
  }));

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Schedule</h1>
      <p className="mt-1.5 text-sm text-muted">New episodes this week, in your local time.</p>
      <ScheduleView items={items} mine={mine} loggedIn={!!userId} />
    </div>
  );
}
