import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import FavoritesGrid from "@/components/account/FavoritesGrid";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const userId = (await requirePageUserId("/account/favorites"));
  const favorites = await prisma.favorite.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
  return (
    <FavoritesGrid
      initial={favorites.map((f) => ({ anilistId: f.anilistId, title: f.title, coverImage: f.coverImage, addedAt: f.addedAt.toISOString() }))}
    />
  );
}
