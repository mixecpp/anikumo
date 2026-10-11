import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";

/** POST { pollId, anilistId } casts or changes your vote. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to vote", 401);
  const b = await readJson<{ pollId: string; anilistId: number }>(req);
  const anilistId = toInt(b.anilistId);
  const poll = await prisma.poll.findUnique({ where: { id: String(b.pollId ?? "") } });
  if (!poll || !anilistId) return fail("Poll not found", 404);
  if (poll.closesAt && poll.closesAt < new Date()) return fail("This poll has closed");
  const options: { anilistId: number }[] = JSON.parse(poll.options);
  if (!options.some((o) => o.anilistId === anilistId)) return fail("Not an option in this poll");

  await prisma.pollVote.upsert({
    where: { pollId_userId: { pollId: poll.id, userId } },
    create: { pollId: poll.id, userId, anilistId },
    update: { anilistId },
  });
  const groups = await prisma.pollVote.groupBy({ by: ["anilistId"], where: { pollId: poll.id }, _count: true });
  return NextResponse.json({ counts: Object.fromEntries(groups.map((g) => [g.anilistId, g._count])), total: groups.reduce((n, g) => n + g._count, 0), myVote: anilistId });
}
