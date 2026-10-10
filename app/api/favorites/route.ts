import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to add favorites", 401);
  const b = await readJson<{ anilistId: number; title: string; coverImage: string }>(req);
  const anilistId = toInt(b.anilistId);
  if (!anilistId) return fail("anilistId required");

  const where = { userId_anilistId: { userId, anilistId } };
  const existing = await prisma.favorite.findUnique({ where });
  if (existing) {
    await prisma.favorite.delete({ where });
    return NextResponse.json({ favorited: false });
  }
  await prisma.favorite.create({
    data: {
      userId,
      anilistId,
      title: String(b.title ?? "").slice(0, 300),
      coverImage: String(b.coverImage ?? "").slice(0, 500),
    },
  });
  return NextResponse.json({ favorited: true });
}
