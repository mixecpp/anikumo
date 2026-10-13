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

/**
 * Progress samples are stamped with the browser's clock. A device whose clock runs ahead (a
 * laptop set to the wrong time) used to get every save rejected with a 400, and its future
 * timestamps would also hide newer saves from other devices. Anything more than 30 seconds
 * ahead of the server is treated as "just now" instead.
 */
function fromDeviceClock(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  const now = Date.now();
  return typeof b.sampledAt === "number" && b.sampledAt > now + 30_000 ? { ...b, sampledAt: now } : b;
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  let input;
  try { input = parseProgress(fromDeviceClock(await req.json())); } catch (error) { return fail(error instanceof Error ? error.message : "Invalid progress"); }
  if (input.expectedUserId && input.expectedUserId !== userId) return fail("Account changed. Reload the watch page.", 409);
  const { anilistId, episode, sampledAt } = input;
  // Removed from history: ignore samples from before the removal (e.g. a save still queued in the browser).
  const cutoff = await prisma.historyCutoff.findFirst({ where: { userId, anilistId: { in: [anilistId, 0] }, before: { gte: sampledAt } }, select: { before: true } });
  if (cutoff) return NextResponse.json({ ok: true, saved: false, completed: false, sampledAt: cutoff.before });
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
  const all = sp.get("all") === "1";
  const anilistId = all ? 0 : positiveId(sp.get("anilistId"));
  if (!all && !anilistId) return fail("anilistId required");
  const where = all ? { userId } : { userId, anilistId: anilistId! };
  // Remember where the history was cut so older samples (in the browser's same clock as
  // sampledAt) can't bring the show back. ?before= is the browser's own Date.now().
  const latest = await prisma.watchProgress.aggregate({ where, _max: { sampledAt: true } });
  // Never in the future: a device with a fast clock would otherwise block saves from every
  // other device until its clock time came round.
  const before = Math.max(Math.min(Number(sp.get("before")) || 0, Date.now()), latest._max.sampledAt ?? 0);
  const [{ count }] = await prisma.$transaction([
    prisma.watchProgress.deleteMany({ where }),
    prisma.watchCursor.deleteMany({ where }),
    prisma.historyCutoff.upsert({ where: { userId_anilistId: { userId, anilistId: anilistId! } }, create: { userId, anilistId: anilistId!, before }, update: { before } }),
  ]);
  return NextResponse.json({ ok: true, count });
}
