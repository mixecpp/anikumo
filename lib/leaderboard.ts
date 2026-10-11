import { prisma } from "./db";
import { cached } from "./cache";
import { localDay } from "./watchtime";

export type LeaderPeriod = "week" | "month" | "all";
export type LeaderRow = { rank: number; userId: string; username: string; avatarColor: string; avatar: string; seconds: number; episodes: number; shows: number };

function since(period: LeaderPeriod) {
  if (period === "all") return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (period === "week" ? 6 : 29));
  return localDay(d);
}

/** Ranked by active watch time. Only users who made their profile public appear. */
export async function getLeaderboard(period: LeaderPeriod, limit = 50): Promise<LeaderRow[]> {
  return cached(`leaderboard:${period}:${limit}`, 120, async () => {
    const day = since(period);
    const publicUsers = await prisma.user.findMany({ where: { profilePublic: true }, select: { id: true, username: true, avatarColor: true, avatar: true } });
    if (!publicUsers.length) return [];
    const ids = publicUsers.map((u) => u.id);
    const where = { userId: { in: ids }, ...(day ? { day: { gte: day } } : {}) };
    const [totals, perEpisode] = await Promise.all([
      prisma.watchTime.groupBy({ by: ["userId"], where, _sum: { seconds: true } }),
      prisma.watchTime.groupBy({ by: ["userId", "anilistId", "episode"], where, _sum: { seconds: true } }),
    ]);
    const byUser = new Map(publicUsers.map((u) => [u.id, u]));
    const episodes = new Map<string, number>();
    const shows = new Map<string, Set<number>>();
    for (const e of perEpisode) {
      // An episode counts once at least 10 minutes of it were actively watched in the period.
      if ((e._sum.seconds ?? 0) >= 600) episodes.set(e.userId, (episodes.get(e.userId) ?? 0) + 1);
      if (!shows.has(e.userId)) shows.set(e.userId, new Set());
      shows.get(e.userId)!.add(e.anilistId);
    }
    return totals
      .filter((t) => (t._sum.seconds ?? 0) >= 60)
      .sort((a, b) => (b._sum.seconds ?? 0) - (a._sum.seconds ?? 0))
      .slice(0, limit)
      .map((t, i) => {
        const u = byUser.get(t.userId)!;
        return { rank: i + 1, userId: t.userId, username: u.username, avatarColor: u.avatarColor, avatar: u.avatar, seconds: t._sum.seconds ?? 0, episodes: episodes.get(t.userId) ?? 0, shows: shows.get(t.userId)?.size ?? 0 };
      });
  });
}
