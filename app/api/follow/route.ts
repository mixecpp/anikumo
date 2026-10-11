import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

/** POST { username } toggles following a user with a public profile. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to follow people", 401);
  if (!rateLimit(`follow:${userId}`, 60, 60 * 60_000).ok) return fail("Slow down a little.", 429);
  const { username } = await readJson<{ username: string }>(req);
  const target = await prisma.user.findUnique({ where: { username: String(username ?? "") }, select: { id: true, profilePublic: true } });
  if (!target || !target.profilePublic) return fail("User not found", 404);
  if (target.id === userId) return fail("You can't follow yourself");

  const key = { followerId_followingId: { followerId: userId, followingId: target.id } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (existing) {
    await prisma.follow.delete({ where: key });
    return NextResponse.json({ following: false });
  }
  await prisma.follow.create({ data: { followerId: userId, followingId: target.id } });
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, profilePublic: true } });
  await notify(target.id, {
    type: "follow",
    title: `${me.username} started following you`,
    href: me.profilePublic ? `/u/${me.username}` : "",
    key: `follow:${userId}`,
  });
  return NextResponse.json({ following: true });
}
