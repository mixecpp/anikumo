import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/auth";
import { logAdmin } from "@/lib/admin";
import { checkEdit, checkWrite, writeStatus } from "@/lib/spam";
import { removeAndNotify } from "@/lib/reports";
import { getSnapshots } from "@/lib/media";
import { HOST_AWAY_MS, MESSAGE_MAX, NAME_MAX, ONLINE_MS, ROOM_MAX_MEMBERS, guestCount, normaliseCode, onlineMembers, openRoom, roomMessages, touchGuest } from "@/lib/rooms";

type Ctx = { params: Promise<{ code: string }> };

/**
 * GET ?since=ISO — everything the room page polls for: the room's state (episode, the host's
 * position), who's here, and chat messages newer than `since` (the last 50 without it).
 * Being here keeps you "online" in the room.
 */
export async function GET(req: Request, { params }: Ctx) {
  const room = await openRoom(normaliseCode((await params).code));
  if (!room) return NextResponse.json({ closed: true }, { status: 404 });
  const me = await requireUserId();
  const now = Date.now();

  const member = me ? await prisma.watchRoomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId: me } } }) : null;
  if (member && !member.kicked && now - member.lastSeenAt.getTime() > 8_000) {
    await prisma.watchRoomMember.update({ where: { roomId_userId: { roomId: room.id, userId: me! } }, data: { lastSeenAt: new Date() } });
  }
  if (me === room.hostId && now - room.lastActiveAt.getTime() > 30_000) await prisma.watchRoom.update({ where: { id: room.id }, data: { lastActiveAt: new Date() } });
  if (!me) touchGuest(room.id, createHash("sha256").update(`${clientIp(req.headers)}|${req.headers.get("user-agent") ?? ""}`).digest("base64url").slice(0, 16));

  // The host vanished (closed the tab) but people are still watching: the longest-staying
  // person takes over so the room keeps going.
  if (now - room.hostSeen > 3 * 60_000) {
    const next = await prisma.watchRoomMember.findFirst({
      where: { roomId: room.id, kicked: false, userId: { not: room.hostId }, lastSeenAt: { gt: new Date(now - ONLINE_MS) } },
      orderBy: { joinedAt: "asc" },
    });
    if (next) {
      await prisma.watchRoom.update({ where: { id: room.id }, data: { hostId: next.userId, lastActiveAt: new Date() } });
      room.hostId = next.userId;
      room.hostSeen = now;
    }
  }

  const sinceRaw = new URL(req.url).searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : null;
  const [members, messages] = await Promise.all([onlineMembers(room.id), roomMessages(room.id, since)]);
  const staff = me ? !!(await requireStaff()) : false;

  return NextResponse.json(
    {
      serverNow: now,
      room: {
        code: room.code,
        name: room.name,
        isPublic: room.isPublic,
        anilistId: room.anilistId,
        episode: room.episode,
        animeTitle: room.animeTitle,
        animeCover: room.animeCover,
        position: room.position,
        positionAt: room.positionAt.getTime(),
        playing: room.playing,
        chatOn: room.chatOn,
        hostId: room.hostId,
        hostAway: now - room.hostSeen > HOST_AWAY_MS,
      },
      members,
      guests: guestCount(room.id),
      messages,
      me: me ? { id: me, isHost: me === room.hostId, member: !!member && !member.kicked, kicked: !!member?.kicked, staff } : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * POST { action, ... }
 *   everyone (logged in): join | leave | send {body} | deleteMessage {id} (yours)
 *   host: state {position, playing} | setEpisode {anilistId, episode} | settings {name?, isPublic?, chatOn?}
 *         | kick {userId} | makeHost {userId} | deleteMessage {id} (anyone's) | close
 *   staff: deleteMessage (author is notified) | kick | close
 */
export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to join the room", 401);
  if (!rateLimit(`room-act:${userId}`, 120, 60_000).ok) return fail("Slow down a little", 429);
  const room = await openRoom(normaliseCode((await params).code));
  if (!room) return fail("This room has ended", 404);
  const b = await readJson<Record<string, unknown>>(req);
  const isHost = userId === room.hostId;
  const memberKey = { roomId_userId: { roomId: room.id, userId } };
  const member = await prisma.watchRoomMember.findUnique({ where: memberKey });
  const ok = () => NextResponse.json({ ok: true });

  switch (b.action) {
    case "join": {
      if (member?.kicked) return fail("The host removed you from this room", 403);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { bannedAt: true } });
      if (!user || user.bannedAt) return fail("Your account can't join rooms right now", 403);
      if (!member) {
        const online = await prisma.watchRoomMember.count({ where: { roomId: room.id, kicked: false, lastSeenAt: { gt: new Date(Date.now() - ONLINE_MS) } } });
        if (online >= ROOM_MAX_MEMBERS) return fail("This room is full", 403);
      }
      await prisma.watchRoomMember.upsert({ where: memberKey, create: { roomId: room.id, userId }, update: { lastSeenAt: new Date() } });
      return ok();
    }

    case "leave": {
      if (!member) return ok();
      if (isHost) {
        // Hand the room to whoever has been here longest; nobody left → the room ends.
        const next = await prisma.watchRoomMember.findFirst({
          where: { roomId: room.id, kicked: false, userId: { not: userId }, lastSeenAt: { gt: new Date(Date.now() - ONLINE_MS) } },
          orderBy: { joinedAt: "asc" },
        });
        if (next) await prisma.watchRoom.update({ where: { id: room.id }, data: { hostId: next.userId, lastActiveAt: new Date() } });
        else await prisma.watchRoom.update({ where: { id: room.id }, data: { closedAt: new Date() } });
      }
      // Keep the row (so a kick sticks) but mark them gone.
      await prisma.watchRoomMember.update({ where: memberKey, data: { lastSeenAt: new Date(0) } });
      return ok();
    }

    case "send": {
      if (!member || member.kicked) return fail("Join the room to chat", 403);
      if (!room.chatOn && !isHost) return fail("The host turned chat off", 403);
      const body = String(b.body ?? "").trim();
      if (!body || body.length > MESSAGE_MAX) return fail(`Messages are 1–${MESSAGE_MAX} characters`);
      const problem = await checkWrite(userId, "room_message", body);
      if (problem) return fail(problem, writeStatus(problem));
      await prisma.watchRoomMessage.create({ data: { roomId: room.id, userId, body } });
      await prisma.watchRoomMember.update({ where: memberKey, data: { lastSeenAt: new Date() } });
      return ok();
    }

    case "deleteMessage": {
      const msg = await prisma.watchRoomMessage.findFirst({ where: { id: String(b.id ?? ""), roomId: room.id }, include: { user: { select: { username: true } } } });
      if (!msg) return fail("Message not found", 404);
      if (msg.userId === userId || isHost) {
        await prisma.watchRoomMessage.delete({ where: { id: msg.id } });
        return ok();
      }
      const staff = await requireStaff();
      if (!staff) return fail("Message not found", 404);
      await removeAndNotify("room_message", msg.id);
      await logAdmin(staff.id, "Deleted Watch Together message", msg.user.username, msg.body.slice(0, 200));
      return ok();
    }
  }

  // ── Host controls (staff can also kick and close) ──
  const staff = isHost ? null : await requireStaff();
  if (!isHost && !(staff && (b.action === "kick" || b.action === "close"))) return fail("Only the host can do that", 403);

  switch (b.action) {
    case "state": {
      const position = Number(b.position);
      if (!Number.isFinite(position) || position < 0 || position > 86400) return fail("Invalid position");
      await prisma.watchRoom.update({ where: { id: room.id }, data: { position, positionAt: new Date(), playing: b.playing === true, lastActiveAt: new Date() } });
      return ok();
    }

    case "setEpisode": {
      const anilistId = toInt(b.anilistId) ?? room.anilistId;
      const episode = toInt(b.episode);
      if (!anilistId || anilistId <= 0 || !episode || episode < 1 || episode > 5000) return fail("Pick an episode");
      let meta = { animeTitle: room.animeTitle, animeCover: room.animeCover };
      if (anilistId !== room.anilistId) {
        const snap = (await getSnapshots([anilistId])).get(anilistId);
        if (!snap) return fail("Couldn't find that anime");
        meta = { animeTitle: snap.title, animeCover: snap.coverImage };
      }
      await prisma.watchRoom.update({ where: { id: room.id }, data: { anilistId, episode, ...meta, position: 0, positionAt: new Date(), playing: false, lastActiveAt: new Date() } });
      return ok();
    }

    case "settings": {
      const data: Record<string, unknown> = { lastActiveAt: new Date() };
      if (b.name !== undefined) {
        const name = String(b.name).trim().replace(/\s+/g, " ");
        if (name.length < 3 || name.length > NAME_MAX) return fail(`Room names are 3–${NAME_MAX} characters`);
        const problem = await checkEdit(userId, name);
        if (problem) return fail(problem);
        data.name = name;
      }
      if (b.isPublic !== undefined) data.isPublic = b.isPublic === true;
      if (b.chatOn !== undefined) data.chatOn = b.chatOn === true;
      await prisma.watchRoom.update({ where: { id: room.id }, data });
      return ok();
    }

    case "kick": {
      const target = String(b.userId ?? "");
      if (!target || target === room.hostId) return fail("You can't remove the host");
      await prisma.watchRoomMember.updateMany({ where: { roomId: room.id, userId: target }, data: { kicked: true } });
      if (staff) await logAdmin(staff.id, "Removed someone from a Watch Together room", target, room.code);
      return ok();
    }

    case "makeHost": {
      const target = await prisma.watchRoomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId: String(b.userId ?? "") } } });
      if (!target || target.kicked || Date.now() - target.lastSeenAt.getTime() > ONLINE_MS) return fail("They need to be in the room");
      await prisma.watchRoom.update({ where: { id: room.id }, data: { hostId: target.userId, lastActiveAt: new Date() } });
      return ok();
    }

    case "close": {
      await prisma.watchRoom.update({ where: { id: room.id }, data: { closedAt: new Date() } });
      if (staff) await logAdmin(staff.id, "Closed a Watch Together room", room.name, room.code);
      return ok();
    }
  }
  return fail("Unknown action");
}
