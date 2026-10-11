import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth";
import { getAccountStats } from "@/lib/account";
import { formatDuration } from "@/lib/watchtime";
import ActivityGrid from "@/components/account/ActivityGrid";

export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage() {
  const s = await getAccountStats((await requirePageUserId("/account/stats")));
  const rows: [string, string][] = [
    ["Active watch time", formatDuration(s.secondsWatched)],
    ["Last 7 days", formatDuration(s.secondsThisWeek)],
    ["Episodes watched (≥50% actively viewed)", String(s.episodesWatched)],
    ["Shows started", String(s.showsStarted)],
    ["Shows completed", String(s.showsCompleted)],
    ["Current streak", `${s.currentStreak} days`],
    ["Longest streak", `${s.longestStreak} days`],
    ["Average per active day", formatDuration(s.avgPerActiveDay)],
    ["Reviews written", String(s.reviews)],
    ["Comments", String(s.comments)],
  ];
  return (
    <div className="space-y-10">
      <dl className="panel divide-y divide-white/[0.05] rounded-2xl">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h2 className="mb-4 text-sm font-medium">Daily watch time</h2>
        <ActivityGrid activity={s.activity} />
      </section>
    </div>
  );
}
