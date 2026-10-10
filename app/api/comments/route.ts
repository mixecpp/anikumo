import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";

const SELECT = {
  id: true,
  body: true,
  episode: true,
  createdAt: true,
  user: { select: { id: true, username: true, avatarColor: true } },
} as const;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const anilistId = toInt(sp.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  const episode = sp.get("episode") ? toInt(sp.get("episode")) : null;
  const comments = await prisma.comment.findMany({
    where: { anilistId, episode },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: SELECT,
  });
  return NextResponse.json({ comments, me: await requireUserId() });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to comment", 401);
  const b = await readJson<{ anilistId: number; episode: number | null; body: string }>(req);
  const anilistId = toInt(b.anilistId);
  const episode = b.episode == null ? null : toInt(b.episode);
  const body = String(b.body ?? "").trim();
  if (!anilistId) return fail("anilistId required");
  if (!body || body.length > 2000) return fail("Comment must be 1–2000 characters");

  const recent = await prisma.comment.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (recent >= 5) return fail("Slow down — max 5 comments per minute", 429);

  const comment = await prisma.comment.create({ data: { userId, anilistId, episode, body }, select: SELECT });
  return NextResponse.json({ comment });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("id required");
  const { count } = await prisma.comment.deleteMany({ where: { id, userId } });
  if (!count) return fail("Not found", 404);
  return NextResponse.json({ ok: true });
}
