import { prisma } from "./db";
import { dailySeconds, streakFrom, totalSeconds, watchedEpisodes } from "./watchtime";

export const ACTIVITY_DAYS = 7 * 20;

export type AccountStats = {
  secondsWatched: number;
  secondsThisWeek: number;
  episodesWatched: number;
  showsStarted: number;
  showsCompleted: number;
  favorites: number;
  comments: number;
  reviews: number;
  currentStreak: number;
  longestStreak: number;
  avgPerActiveDay: number;
  activity: { date: string; seconds: number }[];
};

/** All numbers are per-user and based on active viewing time, not resume positions. */
export async function getAccountStats(userId: string): Promise<AccountStats> {
  const weekAgo = new Date(Date.now() - 6 * 86_400_000);
  const [total, week, watched, daily, started, completed, favorites, comments, reviews] = await Promise.all([
    totalSeconds(userId),
    totalSeconds(userId, weekAgo),
    watchedEpisodes(userId),
    dailySeconds(userId, ACTIVITY_DAYS),
    prisma.watchTime.findMany({ where: { userId }, distinct: ["anilistId"], select: { anilistId: true } }),
    prisma.listEntry.count({ where: { userId, status: "COMPLETED" } }),
    prisma.favorite.count({ where: { userId } }),
    prisma.comment.count({ where: { userId } }),
    prisma.review.count({ where: { userId } }),
  ]);

  let longest = 0;
  let run = 0;
  for (const d of daily) {
    run = d.seconds >= 300 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const activeDays = daily.filter((d) => d.seconds >= 60).length;

  return {
    secondsWatched: total,
    secondsThisWeek: week,
    episodesWatched: watched.length,
    showsStarted: started.length,
    showsCompleted: completed,
    favorites,
    comments,
    reviews,
    currentStreak: streakFrom(daily),
    longestStreak: longest,
    avgPerActiveDay: activeDays ? daily.reduce((n, d) => n + d.seconds, 0) / activeDays : 0,
    activity: daily,
  };
}

export type HistoryShow = {
  anilistId: number;
  title: string;
  coverImage: string;
  episodesWatched: number;
  lastEpisode: number;
  lastProgressPct: number;
  lastCompleted: boolean;
  lastWatched: string;
};

export type HistoryEvent = {
  anilistId: number;
  title: string;
  coverImage: string;
  episode: number;
  pct: number;
  completed: boolean;
  at: string;
};

export async function getHistory(userId: string) {
  const rows = await prisma.watchProgress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  const shows = new Map<number, HistoryShow>();
  for (const r of rows) {
    const pct = r.completed ? 100 : r.durationSeconds ? Math.round((r.progressSeconds / r.durationSeconds) * 100) : 0;
    const s = shows.get(r.anilistId);
    if (!s) {
      shows.set(r.anilistId, {
        anilistId: r.anilistId,
        title: r.title,
        coverImage: r.coverImage,
        episodesWatched: r.completed ? 1 : 0,
        lastEpisode: r.episode,
        lastProgressPct: pct,
        lastCompleted: r.completed,
        lastWatched: r.updatedAt.toISOString(),
      });
    } else if (r.completed) {
      s.episodesWatched++;
    }
  }

  const events: HistoryEvent[] = rows.slice(0, 200).map((r) => ({
    anilistId: r.anilistId,
    title: r.title,
    coverImage: r.coverImage,
    episode: r.episode,
    pct: r.completed ? 100 : r.durationSeconds ? Math.round((r.progressSeconds / r.durationSeconds) * 100) : 0,
    completed: r.completed,
    at: r.updatedAt.toISOString(),
  }));

  return { shows: [...shows.values()], events };
}
