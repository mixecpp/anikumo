import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, requireUserId } from "@/lib/http";
import { mergeProgress, parseProgress, positiveId } from "@/lib/playback/progress";
import { recordWatchTime } from "@/lib/watchtime";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ progress: [] });
  const anilistId = positiveId(new URL(req.url).searchParams.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  const progress = await prisma.watchProgress.findMany({
    where: { userId, anilistId },
    select: { episode: true, progressSeconds: true, durationSeconds: true, completed: true, updatedAt: true },
    orderBy: { episode: "asc" },
  });
  return NextResponse.json({ progress }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  let input;
  try { input = parseProgress(await req.json()); } catch (error) { return fail(error instanceof Error ? error.message : "Invalid progress"); }
  if (input.expectedUserId && input.expectedUserId !== userId) return fail("Account changed. Reload the watch page.", 409);
  const { anilistId, episode, sampledAt } = input;
  const result = await prisma.$transaction(async (tx) => {
    const where = { userId_anilistId_episode: { userId, anilistId, episode } };
    const previous = await tx.watchProgress.findUnique({ where });
    if (previous && sampledAt <= previous.sampledAt) return { saved: false, completed: previous.completed, progressSeconds: previous.progressSeconds, durationSeconds: previous.durationSeconds, sampledAt: previous.sampledAt };
    const merged = mergeProgress(input, previous);
    const data = { ...merged, sampledAt, title: input.title || previous?.title || "Anime", coverImage: input.coverImage || previous?.coverImage || "" };
    await tx.watchProgress.upsert({ where, create: { userId, anilistId, episode, ...data }, update: data });
    return { saved: true, ...merged, sampledAt };
  });
  if (result.saved) await recordWatchTime(userId, input).catch(() => 0);
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const sp = new URL(req.url).searchParams;
  if (sp.get("all") === "1") {
    const { count } = await prisma.watchProgress.deleteMany({ where: { userId } });
    return NextResponse.json({ ok: true, count });
  }
  const anilistId = positiveId(sp.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  await prisma.watchProgress.deleteMany({ where: { userId, anilistId } });
  return NextResponse.json({ ok: true });
}
