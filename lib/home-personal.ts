import { prisma } from "./db";
import { getMedia, type MediaCard } from "./anilist";
import { getSnapshots } from "./media";
import type { ContinueItem } from "@/components/ContinueWatching";

/** Applies pin/hide choices from the list to Continue Watching. */
export async function arrangeContinue(userId: string, items: ContinueItem[]) {
  const entries = await prisma.listEntry.findMany({ where: { userId, anilistId: { in: items.map((i) => i.anilistId) } }, select: { anilistId: true, pinned: true, hiddenFromContinue: true } });
  const by = new Map(entries.map((e) => [e.anilistId, e]));
  return items.filter((i) => !by.get(i.anilistId)?.hiddenFromContinue).sort((a, b) => Number(!!by.get(b.anilistId)?.pinned) - Number(!!by.get(a.anilistId)?.pinned));
}

/** Up to two "Because you watched X" rows from your best-rated or most recent shows. */
export async function becauseYouWatched(userId: string, hideEcchi: boolean) {
  const seeds = await prisma.listEntry.findMany({
    where: { userId, status: { in: ["COMPLETED", "WATCHING"] } },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 6,
  });
  if (!seeds.length) return [];
  const onList = new Set((await prisma.listEntry.findMany({ where: { userId }, select: { anilistId: true } })).map((e) => e.anilistId));
  // Rotate seeds daily so the rows change over time.
  const day = Math.floor(Date.now() / 86_400_000);
  const picked = [seeds[day % seeds.length], seeds[(day + 1) % seeds.length]].filter((s, i, arr) => s && arr.findIndex((x) => x.anilistId === s.anilistId) === i);
  const rows: { seedId: number; seedTitle: string; items: MediaCard[] }[] = [];
  for (const s of picked) {
    const m = await getMedia(s.anilistId).catch(() => null);
    if (!m) continue;
    const items = m.recommendations.nodes
      .map((n) => n.mediaRecommendation)
      .filter((x): x is MediaCard => !!x && !onList.has(x.id) && !(hideEcchi && x.genres.includes("Ecchi")))
      .slice(0, 6);
    if (items.length >= 3) rows.push({ seedId: s.anilistId, seedTitle: s.title, items });
  }
  return rows;
}

export type Unfinished = { anilistId: number; title: string; coverImage: string; progress: number; total: number; pct: number; lastAt: string };

/** Shows you stopped partway through, closest to done first. */
export async function unfinished(userId: string): Promise<Unfinished[]> {
  const cutoff = new Date(Date.now() - 14 * 86_400_000);
  const rows = await prisma.listEntry.findMany({ where: { userId, status: { in: ["WATCHING", "PAUSED"] }, progress: { gt: 0 }, updatedAt: { lt: cutoff } }, take: 40 });
  const snaps = await getSnapshots(rows.map((r) => r.anilistId));
  return rows
    .map((r) => {
      const total = snaps.get(r.anilistId)?.episodes ?? 0;
      return { anilistId: r.anilistId, title: r.title, coverImage: r.coverImage, progress: r.progress, total, pct: total ? r.progress / total : 0, lastAt: r.updatedAt.toISOString() };
    })
    .filter((r) => r.total > 0 && r.progress < r.total)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
}
