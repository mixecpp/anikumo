import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { isReaction } from "@/lib/reactions";

async function summary(anilistId: number, episode: number, userId: string | null) {
  const [groups, mine] = await Promise.all([
    prisma.episodeReaction.groupBy({ by: ["emoji"], where: { anilistId, episode }, _count: true }),
    userId ? prisma.episodeReaction.findMany({ where: { anilistId, episode, userId }, select: { emoji: true } }) : [],
  ]);
  return { counts: Object.fromEntries(groups.map((g) => [g.emoji, g._count])), mine: mine.map((m) => m.emoji) };
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const anilistId = toInt(sp.get("anilistId"));
  const episode = toInt(sp.get("episode"));
  if (!anilistId || !episode) return fail("anilistId and episode required");
  return NextResponse.json(await summary(anilistId, episode, await requireUserId()));
}

/** POST { anilistId, episode, emoji } toggles one reaction. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to react", 401);
  const body = await readJson<{ anilistId: number; episode: number; emoji: string }>(req);
  const anilistId = toInt(body.anilistId);
  const episode = toInt(body.episode);
  if (!anilistId || !episode || episode < 1) return fail("anilistId and episode required");
  if (!isReaction(body.emoji)) return fail("Unknown reaction");

  const key = { userId_anilistId_episode_emoji: { userId, anilistId, episode, emoji: body.emoji } };
  if (await prisma.episodeReaction.findUnique({ where: key })) await prisma.episodeReaction.delete({ where: key });
  else await prisma.episodeReaction.create({ data: { userId, anilistId, episode, emoji: body.emoji } });
  return NextResponse.json(await summary(anilistId, episode, userId));
}
