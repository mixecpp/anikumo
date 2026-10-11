import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ListEditor from "@/components/lists/ListEditor";

export const metadata: Metadata = { title: "Edit list" };

export default async function ListEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/account/lists/${id}`);
  const list = await prisma.customList.findFirst({ where: { id, userId: user.id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!list) notFound();
  const owner = await prisma.user.findUnique({ where: { id: user.id }, select: { profilePublic: true } });
  return (
    <ListEditor
      list={{ id: list.id, title: list.title, description: list.description, isPublic: list.isPublic }}
      items={list.items.map((i) => ({ anilistId: i.anilistId, title: i.title, coverImage: i.coverImage, note: i.note }))}
      shareUrl={`/u/${user.username}/lists/${list.id}`}
      profilePublic={!!owner?.profilePublic}
    />
  );
}
