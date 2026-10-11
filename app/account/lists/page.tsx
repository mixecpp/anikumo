import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ListsIndex from "@/components/lists/ListsIndex";

export const metadata: Metadata = { title: "Custom lists" };

export default async function ListsPage() {
  const userId = (await requirePageUserId("/account/lists"));
  const lists = await prisma.customList.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { items: { orderBy: { position: "asc" }, take: 4, select: { coverImage: true } }, _count: { select: { items: true } } },
  });
  return (
    <ListsIndex
      initial={lists.map((l) => ({ id: l.id, title: l.title, description: l.description, isPublic: l.isPublic, count: l._count.items, covers: l.items.map((i) => i.coverImage), updatedAt: l.updatedAt.toISOString() }))}
    />
  );
}
