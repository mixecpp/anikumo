import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "./db";
import { clientIp } from "./rate-limit";
import { rankAbove, type Role } from "./roles";
import { automodReason } from "./automod";

const COOKIE = "aw_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const TOUCH_EVERY_MS = 5 * 60_000;
const CHECK_TTL_MS = 20_000;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (16+ chars) in .env");
  if (process.env.NODE_ENV === "production" && (s.startsWith("replace-with") || s.length < 32)) {
    throw new Error("AUTH_SECRET must be a random 32+ character value in production");
  }
  return new TextEncoder().encode(s);
}

type Cached = { userId: string; revoked: boolean; checkedAt: number; touchedAt: number };
const g = globalThis as unknown as { __awSessions?: Map<string, Cached> };
const sessionCache = g.__awSessions ?? new Map<string, Cached>();
g.__awSessions = sessionCache;

export async function createSession(userId: string) {
  const h = await headers();
  const session = await prisma.session.create({
    data: {
      userId,
      userAgent: (h.get("user-agent") ?? "").slice(0, 300),
      ip: clientIp(h).slice(0, 64),
    },
  });
  const token = await new SignJWT({ sub: userId, sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  sessionCache.set(session.id, { userId, revoked: false, checkedAt: Date.now(), touchedAt: Date.now() });
  return session.id;
}

export async function destroySession() {
  const current = await getSession();
  if (current) await revokeSession(current.sid);
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function revokeSession(sid: string, userId?: string) {
  await prisma.session.updateMany({ where: { id: sid, ...(userId ? { userId } : {}), revokedAt: null }, data: { revokedAt: new Date() } });
  const c = sessionCache.get(sid);
  if (c) c.revoked = true;
}

/** Revokes every session for a user, optionally keeping the current one. */
export async function revokeSessions(userId: string, exceptSid?: string) {
  const sessions = await prisma.session.findMany({ where: { userId, revokedAt: null, ...(exceptSid ? { id: { not: exceptSid } } : {}) }, select: { id: true } });
  await prisma.session.updateMany({ where: { id: { in: sessions.map((s) => s.id) } }, data: { revokedAt: new Date() } });
  for (const s of sessions) {
    const c = sessionCache.get(s.id);
    if (c) c.revoked = true;
  }
  return sessions.length;
}

async function readToken(): Promise<{ userId: string; sid: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { userId: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

/** The verified, non-revoked session for this request. */
export const getSession = cache(async (): Promise<{ userId: string; sid: string } | null> => {
  const t = await readToken();
  if (!t) return null;
  const now = Date.now();
  let c = sessionCache.get(t.sid);
  if (!c || now - c.checkedAt > CHECK_TTL_MS) {
    const row = await prisma.session.findUnique({ where: { id: t.sid }, select: { userId: true, revokedAt: true, lastSeenAt: true } });
    c = { userId: row?.userId ?? "", revoked: !row || !!row.revokedAt || row.userId !== t.userId, checkedAt: now, touchedAt: row?.lastSeenAt.getTime() ?? 0 };
    sessionCache.set(t.sid, c);
  }
  if (c.revoked) return null;
  if (now - c.touchedAt > TOUCH_EVERY_MS) {
    c.touchedAt = now;
    prisma.session.update({ where: { id: t.sid }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return t;
});

export async function getUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

export async function getUser() {
  const id = await getUserId();
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, avatarColor: true, avatar: true, createdAt: true, isAdmin: true, isModerator: true },
  });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

/** Short-lived proof that the password step passed, used for the 2FA step. */
export async function signTwoFactorTicket(userId: string) {
  return new SignJWT({ sub: userId, purpose: "2fa" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret());
}

export async function verifyTwoFactorTicket(ticket: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(ticket, secret(), { algorithms: ["HS256"] });
    return payload.purpose === "2fa" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function envAdminNames() {
  return (process.env.ADMIN_USERNAMES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Admins are users flagged in the DB. ADMIN_USERNAMES only bootstraps that flag: the first time a
 * listed user is seen it's saved to their account, so it follows the account, not the name.
 * Those names are reserved (see checkUsername) so nobody else can take one over.
 */
export function isAdminUser(user: { isAdmin: boolean; username: string } | null | undefined) {
  if (!user) return false;
  return user.isAdmin || envAdminNames().includes(user.username.toLowerCase());
}

/**
 * Staff roles, highest first. Owners are the accounts named in ADMIN_USERNAMES: always admins,
 * and nobody else can demote, ban, sign out, reset or delete them. Admins run the site;
 * moderators can only moderate (reports, removing content, muting and banning regular users).
 */
export type { Role } from "./roles";

export function isOwnerName(username: string) {
  return envAdminNames().includes(username.toLowerCase());
}

export function roleOf(user: { username: string; isAdmin: boolean; isModerator?: boolean } | null | undefined): Role {
  if (!user) return "user";
  if (isOwnerName(user.username)) return "owner";
  if (user.isAdmin) return "admin";
  return user.isModerator ? "moderator" : "user";
}

/** Can `actor` take action against `target`? Only against people below them. */
export function outranks(actor: Parameters<typeof roleOf>[0], target: Parameters<typeof roleOf>[0]) {
  return rankAbove(roleOf(actor), roleOf(target));
}

export const isStaffRole = (role: Role) => role !== "user";

/** Select these with a user to show their staff badge next to their name. */
export const ROLE_FIELDS = { isAdmin: true, isModerator: true } as const;

/** Swaps a user row's staff flags for their public role (owner, admin, moderator or user). */
export function withRole<T extends { username: string; isAdmin: boolean; isModerator: boolean }>(u: T): Omit<T, "isAdmin" | "isModerator"> & { role: Role } {
  const { isAdmin, isModerator, ...rest } = u;
  return { ...rest, role: roleOf({ username: u.username, isAdmin, isModerator }) };
}

/** The signed-in moderator, admin or owner (with their role), or null. */
export async function requireStaff() {
  const user = await getUser();
  const role = roleOf(user);
  if (!user || !isStaffRole(role)) return null;
  if (role === "owner" && !user.isAdmin) await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  return { ...user, role };
}

export async function requireStaffPage() {
  const staff = await requireStaff();
  if (!staff) notFound();
  return staff;
}

const RESERVED = new Set(["admin", "administrator", "anikumo", "support", "moderator", "mod", "staff", "system", "official", "root"]);

/**
 * Returns an error message when a username can't be used, or null. Names are unique ignoring case
 * so "Ryan" can't impersonate "ryan". Names in ADMIN_USERNAMES can be registered only until an
 * admin exists, and never taken by renaming.
 */
export async function checkUsername(username: string, opts: { exceptUserId?: string; rename?: boolean } = {}) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return "Username must be 3–20 letters, numbers or _";
  const lower = username.toLowerCase();
  if (RESERVED.has(lower)) return "That username is reserved";
  if (automodReason(username.replace(/_/g, " ")) || automodReason(username)) return "That username isn't allowed";
  if (envAdminNames().includes(lower) && (opts.rename || (await prisma.user.count({ where: { isAdmin: true } })) > 0)) return "That username is reserved";
  const clash = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE lower(username) = ${lower} LIMIT 1`;
  if (clash.length && clash[0].id !== opts.exceptUserId) return "That username is taken";
  return null;
}

/*
 * Page guards. A layout's check does NOT protect the pages under it: layouts and pages render in
 * parallel, and on client navigation (or a crafted RSC request) only the page segment is rendered.
 * So every protected page calls one of these itself.
 */
export async function requirePageUserId(next = "/account") {
  const id = await getUserId();
  if (!id) redirect(`/login?next=${encodeURIComponent(next)}`);
  return id;
}

export async function requireAdminPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();
  return admin;
}

export async function requireAdmin() {
  const user = await getUser();
  if (!isAdminUser(user)) return null;
  if (!user!.isAdmin) await prisma.user.update({ where: { id: user!.id }, data: { isAdmin: true } });
  return user;
}
