import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, requireUserId } from "@/lib/http";
import { randomToken, sha256 } from "@/lib/crypto";
import { appUrl } from "@/lib/url";

/** Creates or rotates the private calendar feed URL. DELETE turns the feed off. */
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const token = randomToken(24);
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: sha256(token) } });
  return NextResponse.json({ url: appUrl(`/api/calendar/${token}`) });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: null } });
  return NextResponse.json({ ok: true });
}
