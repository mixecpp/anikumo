import { prisma } from "./db";
import type { ContinueItem } from "@/components/ContinueWatching";

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
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
