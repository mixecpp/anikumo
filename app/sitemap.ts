import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { GENRES, SEASON_ORDER, currentSeason, shiftSeason } from "@/lib/anilist";
import { animeChunk, topCharacters, topStaff, topStudios } from "@/lib/sitemap-data";
import { appUrl } from "@/lib/url";

// Built on request (and cached in memory for a day), never at build time.
export const dynamic = "force-dynamic";

/**
 * /sitemap/0.xml  site pages, genre + season landing pages, public profiles and lists
 * /sitemap/1-4    2,000 most popular anime
 * /sitemap/5      top characters
 * /sitemap/6      top staff and studios
 * The index of all of them is /sitemap-index.xml (submit that one to search engines).
 */
export const SITEMAP_IDS = [0, 1, 2, 3, 4, 5, 6];

export async function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const n = Number(id);

  if (n === 0) {
    const pages = ["/", "/browse", "/season", "/schedule", "/charts", "/trailers", "/compare", "/leaderboard", "/changelog", "/watch-together", "/rules", "/privacy"].map((p) => ({
      url: appUrl(p),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: p === "/" ? 1 : 0.7,
    }));
    const genres = GENRES.filter((g) => g !== "Ecchi").map((g) => ({ url: appUrl(`/browse?genre=${encodeURIComponent(g)}`), changeFrequency: "weekly" as const, priority: 0.6 }));
    const { season, year } = currentSeason();
    const seasons = Array.from({ length: 9 }, (_, i) => shiftSeason(season, year, 1 - i))
      .filter((s) => SEASON_ORDER.includes(s.season as (typeof SEASON_ORDER)[number]))
      .map((s) => ({ url: appUrl(`/browse?season=${s.season}&year=${s.year}`), changeFrequency: "weekly" as const, priority: 0.5 }));
    const [profiles, lists] = await Promise.all([
      prisma.user.findMany({ where: { profilePublic: true, searchable: true, bannedAt: null }, select: { username: true, createdAt: true }, take: 5000 }),
      prisma.customList.findMany({ where: { isPublic: true, user: { profilePublic: true, bannedAt: null } }, select: { id: true, updatedAt: true, user: { select: { username: true } } }, take: 5000 }),
    ]);
    return [
      ...pages,
      ...genres,
      ...seasons,
      ...profiles.map((p) => ({ url: appUrl(`/u/${p.username}`), lastModified: p.createdAt, changeFrequency: "weekly" as const, priority: 0.3 })),
      ...lists.map((l) => ({ url: appUrl(`/u/${l.user.username}/lists/${l.id}`), lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.3 })),
    ];
  }

  try {
    if (n >= 1 && n <= 4) {
      const rows = await animeChunk(n - 1);
      return rows.map((r, i) => ({
        url: appUrl(`/anime/${r.id}`),
        lastModified: r.updatedAt ? new Date(r.updatedAt * 1000) : now,
        changeFrequency: "weekly" as const,
        priority: n === 1 && i < 100 ? 0.9 : 0.6,
      }));
    }
    if (n === 5) return (await topCharacters()).map((r) => ({ url: appUrl(`/character/${r.id}`), changeFrequency: "monthly" as const, priority: 0.4 }));
    if (n === 6) {
      const [staff, studios] = await Promise.all([topStaff(), topStudios()]);
      return [
        ...staff.map((r) => ({ url: appUrl(`/staff/${r.id}`), changeFrequency: "monthly" as const, priority: 0.3 })),
        ...studios.map((r) => ({ url: appUrl(`/studio/${r.id}`), changeFrequency: "monthly" as const, priority: 0.4 })),
      ];
    }
  } catch {
    // AniList unavailable: an empty sitemap is better than a 500 for crawlers.
  }
  return [];
}
