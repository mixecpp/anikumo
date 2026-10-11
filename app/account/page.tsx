import Link from "next/link";
import type { Metadata } from "next";
import { Award, BarChart3, ChevronRight, Lock, Sparkles, Trophy } from "lucide-react";
import { requirePageUserId } from "@/lib/auth";
import { getAccountStats } from "@/lib/account";
import { getContinueWatching } from "@/lib/progress";
import { getGoals } from "@/lib/goals";
import { friendsActivity } from "@/lib/social";
import { computeAchievements } from "@/lib/achievements";
import { newEpisodeMap } from "@/lib/notifications";
import { getSnapshots } from "@/lib/media";
import { STATUS_LABEL, isStatus } from "@/lib/list-shared";
import { prisma } from "@/lib/db";
import ActivityGrid from "@/components/account/ActivityGrid";
import StatTiles, { type Tile } from "@/components/account/StatTiles";
import GoalsPanel from "@/components/account/GoalsPanel";
import { Avatar } from "@/components/UserMenu";

export const metadata: Metadata = { title: "Account" };

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function AccountOverview() {
  const userId = (await requirePageUserId("/account"));
  const [stats, cont, favorites, goals, friends, completedEntries, listCount, following] = await Promise.all([
    getAccountStats(userId),
    getContinueWatching(userId, 6),
    prisma.favorite.findMany({ where: { userId }, orderBy: { addedAt: "desc" }, take: 8 }),
    getGoals(userId),
    friendsActivity(userId, 8),
    prisma.listEntry.findMany({ where: { userId, status: "COMPLETED" }, select: { anilistId: true } }),
    prisma.customList.count({ where: { userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);
  const [snaps, newEps] = await Promise.all([getSnapshots(completedEntries.map((e) => e.anilistId)), newEpisodeMap(userId, cont.map((c) => c.anilistId)).catch(() => new Map<number, number>())]);
  const longest = Math.max(0, ...completedEntries.map((e) => snaps.get(e.anilistId)?.episodes ?? 0));
  const achievements = computeAchievements(stats, { longestCompletedEpisodes: longest, customLists: listCount, following });
  const earned = achievements.filter((a) => a.earned).length;

  const tiles: Tile[] = [
    { key: "time", label: "Time watched", value: stats.secondsWatched, format: "duration", hint: "Only counts time while an episode is actually playing" },
    { key: "week", label: "Last 7 days", value: stats.secondsThisWeek, format: "duration" },
    { key: "episodes", label: "Episodes watched", value: stats.episodesWatched, hint: "Episodes you actively watched at least half of" },
    { key: "completed", label: "Shows completed", value: stats.showsCompleted },
    { key: "streak", label: "Day streak", value: stats.currentStreak, hint: `Longest: ${stats.longestStreak} days (5+ minutes a day)` },
    { key: "avg", label: "Avg per active day", value: stats.avgPerActiveDay, format: "duration" },
  ];

  const year = new Date().getFullYear();

  return (
    <div className="space-y-12">
      <StatTiles tiles={tiles} />

      <div className="flex flex-wrap gap-2">
        <Link href="/account/stats" className="btn btn-ghost !py-1.5 !text-xs">
          <BarChart3 className="h-3.5 w-3.5" /> Full stats
        </Link>
        <Link href={`/account/year/${year}`} className="btn btn-ghost !py-1.5 !text-xs">
          <Sparkles className="h-3.5 w-3.5" /> {year} in review
        </Link>
        <Link href="/leaderboard" className="btn btn-ghost !py-1.5 !text-xs">
          <Trophy className="h-3.5 w-3.5" /> Leaderboard
        </Link>
      </div>

      <GoalsPanel goals={goals} />

      <section>
        <h2 className="mb-4 text-sm font-medium">Activity</h2>
        <ActivityGrid activity={stats.activity} />
        {stats.secondsWatched === 0 && <p className="mt-3 text-xs text-muted">Watch time is measured while episodes actually play — it starts filling in as you watch.</p>}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Continue watching</h2>
          <Link href="/account/history" className="group flex items-center gap-0.5 text-sm text-muted hover:text-fg">
            Full history <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {cont.length === 0 ? (
          <Empty text="Nothing in progress." cta={{ href: "/browse", label: "Find something to watch" }} />
        ) : (
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {cont.map((it) => {
              const next = it.completed ? it.nextEpisode ?? it.episode + 1 : it.episode;
              const pct = it.completed ? 0 : it.durationSeconds ? (it.progressSeconds / it.durationSeconds) * 100 : 0;
              const fresh = newEps.get(it.anilistId);
              return (
                <Link key={it.anilistId} href={`/watch/${it.anilistId}/${next}`} className="group flex items-center gap-4 p-3 transition-colors hover:bg-white/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.coverImage} alt="" className="h-14 w-10 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm">{it.title}</span>
                      {fresh && <span className="shrink-0 rounded-full bg-accent/15 px-1.5 font-mono text-[10px] text-accent">{fresh} new</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{it.completed ? `Up next · Episode ${next}` : `Episode ${it.episode}`}</div>
                    {pct > 0 && (
                      <div className="mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            Achievements <span className="font-mono text-[11px] text-muted">{earned}/{achievements.length}</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {achievements.map((a) => (
            <div key={a.id} className={`panel flex items-center gap-3 rounded-xl p-3 ${a.earned ? "" : "opacity-60"}`} title={a.detail}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${a.earned ? "bg-accent/15 text-accent" : "bg-white/[0.05] text-muted"}`}>
                {a.earned ? <Award className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{a.label}</div>
                {a.earned ? (
                  <div className="truncate text-[11px] text-muted">{a.detail}</div>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full bg-white/30" style={{ width: `${a.progress * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium">Friends</h2>
        {friends.length === 0 ? (
          <Empty text={following ? "People you follow haven't updated their lists recently." : "Follow people from their public profiles to see what they're watching."} cta={{ href: "/leaderboard", label: "Find people" }} />
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {friends.map((f) => (
              <li key={`${f.username}-${f.anilistId}`} className="flex items-center gap-3 p-3">
                <Link href={`/u/${f.username}`}>
                  <Avatar name={f.username} color={f.avatarColor} avatar={f.avatar} size={28} />
                </Link>
                <div className="min-w-0 flex-1 text-sm">
                  <Link href={`/u/${f.username}`} className="font-medium hover:underline">
                    {f.username}
                  </Link>{" "}
                  <span className="text-muted">{isStatus(f.status) ? STATUS_LABEL[f.status].toLowerCase() : f.status}</span>{" "}
                  <Link href={`/anime/${f.anilistId}`} className="hover:underline">
                    {f.title}
                  </Link>
                  {f.score ? <span className="ml-1.5 font-mono text-[11px] text-muted">★ {f.score}</span> : null}
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted">{ago(f.at)}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.coverImage} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Recent favorites</h2>
          <Link href="/account/favorites" className="group flex items-center gap-0.5 text-sm text-muted hover:text-fg">
            All favorites <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {favorites.length === 0 ? (
          <Empty text="No favorites yet." cta={{ href: "/browse", label: "Browse anime" }} />
        ) : (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {favorites.map((f) => (
              <Link key={f.id} href={`/anime/${f.anilistId}`} className="group" title={f.title}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.coverImage} alt={f.title} className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-inset ring-white/[0.06] transition duration-300 group-hover:opacity-80" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-6 py-10 text-center">
      <p className="text-sm text-muted">{text}</p>
      <Link href={cta.href} className="btn btn-ghost mt-4">
        {cta.label}
      </Link>
    </div>
  );
}
