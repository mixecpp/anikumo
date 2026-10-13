import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";
import { checkEdit } from "@/lib/spam";
import { getSnapshots } from "@/lib/media";
import { NAME_MAX, newCode, publicRooms } from "@/lib/rooms";

/** GET → open public rooms for the lobby. */
export async function GET() {
  return NextResponse.json({ rooms: await publicRooms() }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * POST { name, anilistId, episode, isPublic, captcha } → creates a room you host.
 * Needs an account, the human check, and a clean name. Making a new room closes your old one.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to start a room", 401);
  const b = await readJson<{ name: string; anilistId: number; episode: number; isPublic: boolean; captcha: string }>(req);
  if (!rateLimit(`room-create:${userId}`, 4, 3600_000).ok || !rateLimit(`room-create-ip:${clientIp(req.headers)}`, 8, 3600_000).ok) return fail("You've started a lot of rooms — try again later", 429);
  if (!(await verifyCaptcha(b.captcha, clientIp(req.headers), "room"))) return fail("The human check didn't pass — try again", 400);

  const name = String(b.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > NAME_MAX) return fail(`Room names are 3–${NAME_MAX} characters`);
  const problem = await checkEdit(userId, name);
  if (problem) return fail(problem, /muted|can't post/i.test(problem) ? 403 : 400);

  const anilistId = toInt(b.anilistId);
  const episode = toInt(b.episode) ?? 1;
  if (!anilistId || anilistId <= 0 || episode < 1 || episode > 5000) return fail("Pick an anime and episode");
  const snap = (await getSnapshots([anilistId])).get(anilistId);
  if (!snap) return fail("Couldn't find that anime");

  await prisma.watchRoom.updateMany({ where: { hostId: userId, closedAt: null }, data: { closedAt: new Date() } });
  const room = await prisma.watchRoom.create({
    data: { code: await newCode(), name, hostId: userId, isPublic: b.isPublic === true, anilistId, episode, animeTitle: snap.title, animeCover: snap.coverImage },
  });
  await prisma.watchRoomMember.create({ data: { roomId: room.id, userId } });
  return NextResponse.json({ code: room.code });
}
