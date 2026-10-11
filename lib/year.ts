import { prisma } from "./db";
import { getSnapshots } from "./media";

export async function yearInReview(userId: string, year: number) {
  const rows = await prisma.watchTime.findMany({ where: { userId, day: { gte: `${year}-01-01`, lte: `${year}-12-31` } } });
  const total = rows.reduce((n, r) => n + r.seconds, 0);

  const months = Array.from({ length: 12 }, () => 0);
  const perDay = new Map<string, number>();
  const perShow = new Map<number, number>();
  const perEpisode = new Map<string, number>();
  for (const r of rows) {
    months[Number(r.day.slice(5, 7)) - 1] += r.seconds;
    perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.seconds);
    perShow.set(r.anilistId, (perShow.get(r.anilistId) ?? 0) + r.seconds);
    const k = `${r.anilistId}:${r.episode}`;
    perEpisode.set(k, (perEpisode.get(k) ?? 0) + r.seconds);
  }

  const snaps = await getSnapshots([...perShow.keys()]);
  const episodes = [...perEpisode.entries()].filter(([k, s]) => s >= ((snaps.get(Number(k.split(":")[0]))?.duration ?? 24) * 60) * 0.5).length;

  const genres = new Map<string, number>();
  for (const [id, s] of perShow) for (const g of snaps.get(id)?.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + s);

  const topShows = [...perShow.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, seconds]) => ({ anilistId: id, seconds, title: snaps.get(id)?.title ?? "Anime", coverImage: snaps.get(id)?.coverImage ?? "" }));
  const binge = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const completed = await prisma.listEntry.count({ where: { userId, status: "COMPLETED", completedAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } } });

  return {
    year,
    total,
    episodes,
    shows: perShow.size,
    completed,
    activeDays: [...perDay.values()].filter((s) => s >= 60).length,
    months,
    topShows,
    topGenres: [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, seconds]) => ({ name, seconds })),
    binge: binge ? { day: binge[0], seconds: binge[1] } : null,
  };
}
