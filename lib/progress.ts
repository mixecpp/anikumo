import { prisma } from "./db";
import type { ContinueItem } from "@/components/ContinueWatching";
import { getAniweebEpisodes } from "./playback/server";

export async function getContinueWatching(userId: string, limit = 12): Promise<ContinueItem[]> {
  const rows = await prisma.watchProgress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const seen = new Set<number>();
  const out: ContinueItem[] = [];
  for (const r of rows) {
    if (seen.has(r.anilistId)) continue;
    seen.add(r.anilistId);
    if (r.completed || r.progressSeconds >= 5) out.push(r);
    if (out.length >= limit * 2) break;
  }
  const available = await Promise.all(out.map(async (row) => {
    if (!row.completed) return row;
    const episodes = await getAniweebEpisodes(row.anilistId);
    if (!episodes.length) return row;
    const nextEpisode = episodes.find((e) => e.number > row.episode)?.number;
    return nextEpisode ? { ...row, nextEpisode } : null;
  }));
  return available.filter((item): item is NonNullable<typeof item> => item !== null).slice(0, limit);
}
