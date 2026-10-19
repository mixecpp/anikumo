import { prisma } from "./db";
import { roleOf } from "./auth";
import type { Role } from "./roles";

/**
 * The site-wide live chat and announcements (components/live).
 *
 * Everything is polled through GET /api/live: every visitor's page asks every ~30s (for the
 * online count and announcements), and every ~3s while the chat is open. To keep that cheap on
 * SQLite, the hot bits (newest message time, settings, the active announcement, recent
 * deletions and who's online) live in memory; there's a single server process.
 */

export const CHAT_MAX = 400;
/** Seen within this long = online. Closed chats poll every 30s, so it has to be longer than that. */
export const ONLINE_MS = 75_000;
export const PAGE = 50;
const KEEP_DAYS = 30;

export type ChatPerson = { id: string; username: string; avatarColor: string; avatar: string; role: Role };
export const PERSON = { id: true, username: true, avatarColor: true, avatar: true, isAdmin: true, isModerator: true } as const;
export const person = (u: { id: string; username: string; avatarColor: string; avatar: string; isAdmin: boolean; isModerator: boolean }): ChatPerson => ({
  id: u.id,
  username: u.username,
  avatarColor: u.avatarColor,
  avatar: u.avatar,
  role: roleOf(u),
});

export type ChatMessageOut = {
  id: string;
  body: string;
  createdAt: string;
  author: ChatPerson;
  pinned: boolean;
  replyTo: { id: string; body: string; username: string } | null;
  anime: { id: number; episode: number | null; title: string; cover: string } | null;
};

type Store = {
  latestAt: number;
  deleted: { id: string; at: number }[];
  presence: Map<string, { userId: string | null; at: number }>;
  settings: { at: number; value: ChatSettings } | null;
  announcement: { at: number; value: AnnouncementOut | null } | null;
  lastSent: Map<string, number>;
};
const g = globalThis as unknown as { __akChat?: Store };
const store: Store = (g.__akChat ??= { latestAt: 0, deleted: [], presence: new Map(), settings: null, announcement: null, lastSent: new Map() });

// ── Messages ──

const INCLUDE = { user: { select: PERSON }, replyTo: { select: { id: true, body: true, user: { select: { username: true } } } } } as const;
type Row = {
  id: string;
  body: string;
  createdAt: Date;
  pinned: boolean;
  anilistId: number | null;
  episode: number | null;
  animeTitle: string;
  animeCover: string;
  user: { id: string; username: string; avatarColor: string; avatar: string; isAdmin: boolean; isModerator: boolean };
  replyTo: { id: string; body: string; user: { username: string } } | null;
};

export function toOut(m: Row): ChatMessageOut {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    author: person(m.user),
    pinned: m.pinned,
    replyTo: m.replyTo ? { id: m.replyTo.id, body: m.replyTo.body.slice(0, 140), username: m.replyTo.user.username } : null,
    anime: m.anilistId ? { id: m.anilistId, episode: m.episode, title: m.animeTitle, cover: m.animeCover } : null,
  };
}

/** Messages after `since` (oldest first), or the newest page when there is no `since`. */
export async function messagesSince(since: Date | null) {
  const rows = await prisma.chatMessage.findMany({
    // A few seconds of overlap so a message saved a moment late is not skipped; clients drop duplicates by id.
    where: since ? { createdAt: { gt: new Date(since.getTime() - 5_000) } } : {},
    orderBy: { createdAt: since ? "asc" : "desc" },
    take: since ? 100 : PAGE,
    include: INCLUDE,
  });
  return (since ? rows : rows.reverse()).map(toOut);
}

/** The page of messages before message `beforeId` (scrolling back). */
export async function messagesBefore(beforeId: string) {
  const ref = await prisma.chatMessage.findUnique({ where: { id: beforeId }, select: { createdAt: true } });
  if (!ref) return [];
  const rows = await prisma.chatMessage.findMany({ where: { createdAt: { lt: ref.createdAt } }, orderBy: { createdAt: "desc" }, take: PAGE, include: INCLUDE });
  return rows.reverse().map(toOut);
}

export async function pinnedMessage() {
  const m = await prisma.chatMessage.findFirst({ where: { pinned: true }, orderBy: { createdAt: "desc" }, include: INCLUDE });
  return m ? toOut(m) : null;
}

export async function createMessage(data: { userId: string; body: string; replyToId: string | null; anime: { id: number; episode: number | null; title: string; cover: string } | null }) {
  const m = await prisma.chatMessage.create({
    data: {
      userId: data.userId,
      body: data.body,
      replyToId: data.replyToId,
      ...(data.anime ? { anilistId: data.anime.id, episode: data.anime.episode, animeTitle: data.anime.title, animeCover: data.anime.cover } : {}),
    },
    include: INCLUDE,
  });
  store.latestAt = Math.max(store.latestAt, m.createdAt.getTime());
  store.lastSent.set(data.userId, Date.now());
  return toOut(m);
}

/** Deletes a message and tells open chats to drop it. Used by the chat, reports and staff tools. */
export async function deleteMessage(id: string) {
  await prisma.chatMessage.deleteMany({ where: { id } });
  noteDeleted([id]);
}

function noteDeleted(ids: string[]) {
  const now = Date.now();
  for (const id of ids) store.deleted.push({ id, at: now });
  store.deleted = store.deleted.filter((d) => now - d.at < 10 * 60_000).slice(-1000);
}

/** Ids deleted since `since` (a little overlap, like messagesSince). */
export function deletedSince(since: Date | null) {
  if (!since) return [];
  const t = since.getTime() - 5_000;
  return store.deleted.filter((d) => d.at > t).map((d) => d.id);
}

/** Clears the whole chat (staff). */
export async function clearChat() {
  const rows = await prisma.chatMessage.findMany({ select: { id: true }, orderBy: { createdAt: "desc" }, take: 1000 });
  await prisma.chatMessage.deleteMany({});
  noteDeleted(rows.map((r) => r.id));
}

/** Removes every message by one person (staff, e.g. after a spam run). */
export async function purgeUser(userId: string) {
  const rows = await prisma.chatMessage.findMany({ where: { userId }, select: { id: true } });
  await prisma.chatMessage.deleteMany({ where: { userId } });
  noteDeleted(rows.map((r) => r.id));
  return rows.length;
}

export async function latestAt() {
  if (!store.latestAt) {
    const m = await prisma.chatMessage.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    store.latestAt = m?.createdAt.getTime() ?? 1;
  }
  return store.latestAt;
}

/** Keeps the chat to the last month. Called by lib/warm.ts. */
export async function pruneChat() {
  await prisma.chatMessage.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) }, pinned: false } });
}

// ── Slow mode ──

/** Seconds until this person may send again under slow mode (0 = now). */
export function slowWait(userId: string, slowSeconds: number) {
  if (!slowSeconds) return 0;
  const last = store.lastSent.get(userId) ?? 0;
  return Math.max(0, Math.ceil((last + slowSeconds * 1000 - Date.now()) / 1000));
}

// ── Presence ──

/** Marks a visitor as here. `key` is the user id, or a hashed guest key. */
export function touch(key: string, userId: string | null) {
  const now = Date.now();
  store.presence.set(key, { userId, at: now });
  if (store.presence.size > 5000 || Math.random() < 0.02) {
    for (const [k, v] of store.presence) if (now - v.at > ONLINE_MS) store.presence.delete(k);
  }
}

export function onlineCount() {
  const now = Date.now();
  let n = 0;
  for (const v of store.presence.values()) if (now - v.at <= ONLINE_MS) n++;
  return n;
}

/** Signed-in people online right now (most recently active first). */
export async function onlineUsers(limit = 60) {
  const now = Date.now();
  const ids = [...store.presence.values()]
    .filter((v) => v.userId && now - v.at <= ONLINE_MS)
    .sort((a, b) => b.at - a.at)
    .map((v) => v.userId!)
    .filter((id, i, a) => a.indexOf(id) === i)
    .slice(0, limit);
  if (!ids.length) return [];
  const users = await prisma.user.findMany({ where: { id: { in: ids }, bannedAt: null }, select: PERSON });
  const order = new Map(ids.map((id, i) => [id, i]));
  return users.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(person);
}

// ── Settings ──

export type ChatSettings = { on: boolean; slowMode: number };
const DEFAULTS: ChatSettings = { on: true, slowMode: 0 };
export const SLOW_MODES = [0, 5, 10, 30, 60, 300];

export async function chatSettings(): Promise<ChatSettings> {
  if (store.settings && Date.now() - store.settings.at < 30_000) return store.settings.value;
  const row = await prisma.siteSetting.findUnique({ where: { key: "chat" } });
  let value = DEFAULTS;
  try {
    const v = row ? JSON.parse(row.value) : {};
    value = { on: typeof v.on === "boolean" ? v.on : DEFAULTS.on, slowMode: SLOW_MODES.includes(v.slowMode) ? v.slowMode : DEFAULTS.slowMode };
  } catch {}
  store.settings = { at: Date.now(), value };
  return value;
}

export async function saveChatSettings(patch: Partial<ChatSettings>) {
  const value = { ...(await chatSettings()), ...patch };
  await prisma.siteSetting.upsert({ where: { key: "chat" }, create: { key: "chat", value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  store.settings = { at: Date.now(), value };
  return value;
}

// ── Announcements ──

export type AnnouncementOut = { id: string; body: string; href: string; tone: "info" | "important"; createdAt: string; expiresAt: string };
export const ANNOUNCEMENT_MAX = 280;
export const DURATIONS = { "1h": 3600_000, "6h": 6 * 3600_000, "24h": 86_400_000, "3d": 3 * 86_400_000, "7d": 7 * 86_400_000 } as const;

const announcementOut = (a: { id: string; body: string; href: string; tone: string; createdAt: Date; expiresAt: Date }): AnnouncementOut => ({
  id: a.id,
  body: a.body,
  href: a.href,
  tone: a.tone === "important" ? "important" : "info",
  createdAt: a.createdAt.toISOString(),
  expiresAt: a.expiresAt.toISOString(),
});

/** The newest announcement that is still running, or null. */
export async function activeAnnouncement() {
  const now = Date.now();
  if (store.announcement && now - store.announcement.at < 15_000) {
    const v = store.announcement.value;
    return v && Date.parse(v.expiresAt) > now ? v : null;
  }
  const a = await prisma.announcement.findFirst({ where: { endedAt: null, expiresAt: { gt: new Date(now) } }, orderBy: { createdAt: "desc" } });
  const value = a ? announcementOut(a) : null;
  store.announcement = { at: now, value };
  return value;
}

export function forgetAnnouncement() {
  store.announcement = null;
}

export async function announcementHistory() {
  const rows = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { username: true } } } });
  const now = Date.now();
  return rows.map((a) => ({ ...announcementOut(a), author: a.author.username, live: !a.endedAt && a.expiresAt.getTime() > now }));
}

/** Only links on this site (a path) or plain https links; null when it is neither. */
export function cleanHref(raw: unknown) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(s)) return s.slice(0, 300);
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.href.slice(0, 300) : null;
  } catch {
    return null;
  }
}
