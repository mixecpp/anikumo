import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";

/** POST { commentId } toggles your like. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to like comments", 401);
  const { commentId } = await readJson<{ commentId: string }>(req);
  const id = String(commentId ?? "");
  const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) return fail("Not found", 404);
  const key = { userId_commentId: { userId, commentId: id } };
  const liked = !(await prisma.commentLike.findUnique({ where: key }));
  if (liked) await prisma.commentLike.create({ data: { userId, commentId: id } });
  else await prisma.commentLike.delete({ where: key });
  const likeCount = await prisma.commentLike.count({ where: { commentId: id } });
  return NextResponse.json({ liked, likeCount });
}
