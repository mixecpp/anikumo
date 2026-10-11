import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";

/** POST { reviewId } toggles "helpful". You can't vote on your own review. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to vote", 401);
  const { reviewId } = await readJson<{ reviewId: string }>(req);
  const review = await prisma.review.findUnique({ where: { id: String(reviewId ?? "") }, select: { id: true, userId: true } });
  if (!review) return fail("Not found", 404);
  if (review.userId === userId) return fail("You can't vote on your own review");
  const key = { userId_reviewId: { userId, reviewId: review.id } };
  const voted = !(await prisma.reviewVote.findUnique({ where: key }));
  if (voted) await prisma.reviewVote.create({ data: { userId, reviewId: review.id } });
  else await prisma.reviewVote.delete({ where: key });
  return NextResponse.json({ voted, helpful: await prisma.reviewVote.count({ where: { reviewId: review.id } }) });
}
