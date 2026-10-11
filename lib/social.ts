import { prisma } from "./db";

export type FriendActivity = {
  username: string;
  avatarColor: string;
  anilistId: number;
  title: string;
  coverImage: string;
  status: string;
  score: number | null;
  progress: number;
  at: string;
};

/** Recent list activity from people you follow (public profiles only). */
export async function friendsActivity(userId: string, take = 12): Promise<FriendActivity[]> {
  const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  if (!following.length) return [];
  const rows = await prisma.listEntry.findMany({
    where: { userId: { in: following.map((f) => f.followingId) }, user: { profilePublic: true } },
    orderBy: { updatedAt: "desc" },
    take,
    include: { user: { select: { username: true, avatarColor: true } } },
  });
  return rows.map((r) => ({
    username: r.user.username,
    avatarColor: r.user.avatarColor,
    anilistId: r.anilistId,
    title: r.title,
    coverImage: r.coverImage,
    status: r.status,
    score: r.score,
    progress: r.progress,
    at: r.updatedAt.toISOString(),
  }));
}

/** "3 friends finished this" style hint for an anime page. */
export async function friendsOnShow(userId: string | null, anilistId: number) {
  if (!userId) return null;
  const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  if (!following.length) return null;
  const rows = await prisma.listEntry.findMany({
    where: { anilistId, userId: { in: following.map((f) => f.followingId) }, user: { profilePublic: true } },
    include: { user: { select: { username: true, avatarColor: true } } },
  });
  if (!rows.length) return null;
  const scored = rows.filter((r) => r.score !== null);
  return {
    total: rows.length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
    watching: rows.filter((r) => r.status === "WATCHING").length,
    avgScore: scored.length ? scored.reduce((n, r) => n + (r.score ?? 0), 0) / scored.length : null,
    people: rows.slice(0, 5).map((r) => ({ username: r.user.username, avatarColor: r.user.avatarColor, status: r.status, score: r.score })),
  };
}
