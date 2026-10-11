import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** GET ?anilistId= → reviews sorted by helpful votes, plus the viewer's own review. */
export async function GET(req: Request) {
  const anilistId = toInt(new URL(req.url).searchParams.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  const me = await requireUserId();
  const rows = await prisma.review.findMany({
    where: { anilistId },
    orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
    take: 50,
    include: {
      user: { select: { id: true, username: true, avatarColor: true, profilePublic: true } },
      votes: { where: { userId: me ?? "" }, select: { userId: true } },
      _count: { select: { votes: true } },
    },
  });
  const reviews = rows.map(({ votes, _count, ...r }) => ({ ...r, helpful: _count.votes, voted: votes.length > 0 }));
  const avg = rows.length ? rows.reduce((n, r) => n + r.score, 0) / rows.length : null;
  return NextResponse.json({ reviews, me, average: avg, count: rows.length });
}

/** POST { anilistId, score, title, body } creates or updates your review. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to write a review", 401);
  if (!rateLimit(`review:${userId}`, 10, 60 * 60_000).ok) return fail("Slow down a little.", 429);
  const b = await readJson<{ anilistId: number; score: number; title: string; body: string }>(req);
  const anilistId = toInt(b.anilistId);
  const score = toInt(b.score);
  const body = String(b.body ?? "").trim();
  const title = String(b.title ?? "").trim().slice(0, 100);
  if (!anilistId) return fail("anilistId required");
  if (!score || score < 1 || score > 10) return fail("Pick a score from 1 to 10");
  if (body.length < 20 || body.length > 3000) return fail("Reviews need 20–3000 characters");

  const review = await prisma.review.upsert({
    where: { userId_anilistId: { userId, anilistId } },
    create: { userId, anilistId, score, title, body },
    update: { score, title, body },
  });
  return NextResponse.json({ review });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const anilistId = toInt(new URL(req.url).searchParams.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  await prisma.review.deleteMany({ where: { userId, anilistId } });
  return NextResponse.json({ ok: true });
}
