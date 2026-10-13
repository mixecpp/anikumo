import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { roleOf } from "./auth";
import type { Role } from "./roles";

/**
 * Watch Together rooms. A host picks an anime and episode; everyone in the room plays the same
 * episode and the host's position is shared so people can sync up. Public rooms are listed in
 * the lobby; private ones are only reachable with their code.
 *
 * Presence works by polling: members' lastSeenAt is refreshed while they have the room open,
 * and anyone not seen for ONLINE_MS counts as gone. A room whose host has been gone for
 * HOST_TIMEOUT_MS is closed the next time anyone looks at it.
 */
export const ROOM_MAX_MEMBERS = 50;
export const MESSAGE_MAX = 300;
export const NAME_MAX = 40;
export const ONLINE_MS = 30_000;
export const HOST_AWAY_MS = 90_000;
export const HOST_TIMEOUT_MS = 20 * 60_000;

// No 0/O, 1/I/L so codes are easy to read out loud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

export async function newCode() {
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    if (!(await prisma.watchRoom.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Couldn't make a room code");
}

export const normaliseCode = (raw: unknown) => (typeof raw === "string" ? raw.trim().toUpperCase() : "");

/** An open room by code (closing it first if its host has been gone too long), or null. */
export async function openRoom(code: string) {
  if (!CODE_RE.test(code)) return null;
  const room = await prisma.watchRoom.findUnique({ where: { code } });
  if (!room || room.closedAt) return null;
  const host = await prisma.watchRoomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId: room.hostId } }, select: { lastSeenAt: true } });
  const hostSeen = Math.max(host?.lastSeenAt.getTime() ?? 0, room.lastActiveAt.getTime());
  if (Date.now() - hostSeen > HOST_TIMEOUT_MS) {
    await prisma.watchRoom.update({ where: { id: room.id }, data: { closedAt: new Date() } });
    return null;
  }
  return { ...room, hostSeen };
}

export type RoomPerson = { id: string; username: string; avatarColor: string; avatar: string; role: Role };
const PERSON = { id: true, username: true, avatarColor: true, avatar: true, isAdmin: true, isModerator: true } as const;
const person = (u: { id: string; username: string; avatarColor: string; avatar: string; isAdmin: boolean; isModerator: boolean }): RoomPerson => ({
  id: u.id,
  username: u.username,
  avatarColor: u.avatarColor,
  avatar: u.avatar,
  role: roleOf(u),
});

export async function onlineMembers(roomId: string) {
  const rows = await prisma.watchRoomMember.findMany({
    where: { roomId, kicked: false, lastSeenAt: { gt: new Date(Date.now() - ONLINE_MS) } },
    orderBy: { joinedAt: "asc" },
    take: ROOM_MAX_MEMBERS,
    include: { user: { select: PERSON } },
  });
  return rows.map((r) => person(r.user));
}

export async function roomMessages(roomId: string, since: Date | null) {
  const rows = await prisma.watchRoomMessage.findMany({
    where: { roomId, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: since ? "asc" : "desc" },
    take: since ? 100 : 50,
    include: { user: { select: PERSON } },
  });
  const list = since ? rows : rows.reverse();
  return list.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), author: person(m.user) }));
}

/** Guests (not logged in) watching a public room, counted in memory by a per-room key. */
const g = globalThis as unknown as { __akRoomGuests?: Map<string, Map<string, number>> };
const guests = (g.__akRoomGuests ??= new Map());
export function touchGuest(roomId: string, key: string) {
  const m = guests.get(roomId) ?? new Map<string, number>();
  const now = Date.now();
  m.set(key, now);
  for (const [k, t] of m) if (now - t > ONLINE_MS) m.delete(k);
  if (m.size > 500) m.clear();
  guests.set(roomId, m);
}
export function guestCount(roomId: string) {
  const m = guests.get(roomId);
  if (!m) return 0;
  const now = Date.now();
  let n = 0;
  for (const t of m.values()) if (now - t <= ONLINE_MS) n++;
  return n;
}

/** Open public rooms for the lobby, busiest first. */
export async function publicRooms() {
  const rooms = await prisma.watchRoom.findMany({
    where: { isPublic: true, closedAt: null, lastActiveAt: { gt: new Date(Date.now() - HOST_TIMEOUT_MS) } },
    orderBy: { lastActiveAt: "desc" },
    take: 30,
    include: { host: { select: PERSON }, members: { where: { kicked: false, lastSeenAt: { gt: new Date(Date.now() - ONLINE_MS) } }, select: { userId: true } } },
  });
  return rooms
    .map((r) => ({
      code: r.code,
      name: r.name,
      anilistId: r.anilistId,
      episode: r.episode,
      animeTitle: r.animeTitle,
      animeCover: r.animeCover,
      host: person(r.host),
      watching: r.members.length + guestCount(r.id),
      playing: r.playing,
    }))
    .sort((a, b) => b.watching - a.watching);
}
