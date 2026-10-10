import { availableEpisodeCount, type MediaDetail } from "./anilist";
import { prisma } from "./db";
import type { EpisodeInfo, EpisodeProgress } from "@/components/EpisodeGrid";

export function buildEpisodes(m: MediaDetail, libraryEpisodes: number[] = []): EpisodeInfo[] {
  const meta = new Map<number, { title: string | null; thumbnail: string | null }>();
  for (const se of m.streamingEpisodes) {
    const match = se.title.match(/(?:episode|ep\.?)\s*(\d+)\s*[-:–]?\s*(.*)/i);
    if (!match) continue;
    const n = Number(match[1]);
    if (!meta.has(n)) meta.set(n, { title: match[2]?.trim() || null, thumbnail: se.thumbnail || null });
  }
  const count = Math.max(availableEpisodeCount(m), ...meta.keys(), ...libraryEpisodes, 0);
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    title: meta.get(i + 1)?.title ?? null,
    thumbnail: meta.get(i + 1)?.thumbnail ?? null,
  }));
}

export async function getEpisodeProgress(userId: string | null, anilistId: number): Promise<EpisodeProgress> {
  if (!userId) return {};
  const rows = await prisma.watchProgress.findMany({ where: { userId, anilistId } });
  return Object.fromEntries(
    rows.map((r) => [
      r.episode,
      { pct: r.durationSeconds ? Math.round((r.progressSeconds / r.durationSeconds) * 100) : 0, completed: r.completed },
    ]),
  );
}

export async function getLibraryEpisodes(anilistId: number) {
  const eps = await prisma.libraryEpisode.findMany({
    where: { series: { anilistId } },
    select: { episode: true },
  });
  return [...new Set(eps.map((e) => e.episode))];
}
