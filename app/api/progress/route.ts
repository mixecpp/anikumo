import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ progress: [] });
  const anilistId = toInt(new URL(req.url).searchParams.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  const progress = await prisma.watchProgress.findMany({
    where: { userId, anilistId },
    select: { episode: true, progressSeconds: true, durationSeconds: true, completed: true, updatedAt: true },
    orderBy: { episode: "asc" },
  });
  return NextResponse.json({ progress });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const b = await readJson<{
    anilistId: number;
    episode: number;
    progressSeconds: number;
    durationSeconds: number;
    title: string;
    coverImage: string;
    completed: boolean;
  }>(req);

  const anilistId = toInt(b.anilistId);
  const episode = toInt(b.episode);
  if (!anilistId || !episode || episode < 1) return fail("anilistId and episode required");

  const progressSeconds = Math.max(0, Number(b.progressSeconds) || 0);
  const durationSeconds = Math.max(0, Number(b.durationSeconds) || 0);
  const completed =
    b.completed === true || (durationSeconds > 0 && progressSeconds / durationSeconds >= 0.9);
  const title = String(b.title ?? "").slice(0, 300);
  const coverImage = String(b.coverImage ?? "").slice(0, 500);

  await prisma.watchProgress.upsert({
    where: { userId_anilistId_episode: { userId, anilistId, episode } },
    create: { userId, anilistId, episode, progressSeconds, durationSeconds, completed, title, coverImage },
    // Never flip a completed episode back to unwatched on a partial rewatch.
    update: { progressSeconds, durationSeconds, title, coverImage, ...(completed ? { completed } : {}) },
  });
  return NextResponse.json({ ok: true, completed });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const anilistId = toInt(new URL(req.url).searchParams.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  await prisma.watchProgress.deleteMany({ where: { userId, anilistId } });
  return NextResponse.json({ ok: true });
}
