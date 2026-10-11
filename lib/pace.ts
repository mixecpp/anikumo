import { prisma } from "./db";
import { localDay } from "./watchtime";

/** Episodes per day over the last 30 days, from active viewing (an episode counts once 10+ min were watched). */
export async function episodesPerDay(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const rows = await prisma.watchTime.groupBy({ by: ["anilistId", "episode"], where: { userId, day: { gte: localDay(since) } }, _sum: { seconds: true } });
  return rows.filter((r) => (r._sum.seconds ?? 0) >= 600).length / 30;
}

export function timeToFinish(remaining: number, minutesPerEp: number | null, perDay: number) {
  if (remaining <= 0) return null;
  const minutes = remaining * (minutesPerEp ?? 24);
  const days = perDay > 0.05 ? Math.ceil(remaining / perDay) : null;
  return { minutes, days, doneBy: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null };
}
