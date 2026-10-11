import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getHomeData } from "@/lib/anilist";
import { appUrl } from "@/lib/url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = ["/", "/browse", "/season", "/schedule", "/charts", "/trailers", "/compare", "/leaderboard", "/changelog"].map((p) => ({ url: appUrl(p), lastModified: now, changeFrequency: "daily" as const, priority: p === "/" ? 1 : 0.7 }));
  const [home, profiles] = await Promise.all([
    getHomeData().catch(() => null),
    prisma.user.findMany({ where: { profilePublic: true }, select: { username: true, createdAt: true }, take: 1000 }),
  ]);
  const anime = home ? [...new Set([...home.trending.media, ...home.popular.media, ...home.top.media, ...home.seasonal.media].map((m) => m.id))] : [];
  return [
    ...pages,
    ...anime.map((id) => ({ url: appUrl(`/anime/${id}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...profiles.map((p) => ({ url: appUrl(`/u/${p.username}`), lastModified: p.createdAt, changeFrequency: "weekly" as const, priority: 0.3 })),
  ];
}
