import type { Metadata } from "next";
import ErrorNotice from "@/components/ErrorNotice";
import ScheduleView from "@/components/ScheduleView";
import { getSchedule, titleOf } from "@/lib/anilist";

export const metadata: Metadata = { title: "Airing schedule" };
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  const from = Math.floor(start.getTime() / 1000);
  const to = from + 8 * 86400;

  const data = await getSchedule(from, to).catch((e: Error) => e);
  if (data instanceof Error) return <ErrorNotice message={data.message} />;

  const items = data.map((s) => ({
    id: s.id,
    anilistId: s.media.id,
    airingAt: s.airingAt,
    episode: s.episode,
    title: titleOf(s.media),
    cover: s.media.coverImage.large,
    format: s.media.format,
    total: s.media.episodes,
  }));

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Airing schedule</h1>
      <p className="mt-1 text-sm text-muted">Times shown in your local timezone.</p>
      <ScheduleView items={items} />
    </div>
  );
}
