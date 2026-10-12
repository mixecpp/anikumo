import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { ROLE_FIELDS, requireStaff, withRole } from "@/lib/auth";
import { logAdmin } from "@/lib/admin";
import { canViewProfile } from "@/lib/privacy";
import { checkWrite, writeStatus } from "@/lib/spam";
import { removeAndNotify } from "@/lib/reports";

const WALL_MAX = 300;
const PAGE = 15;
const PERSON = { select: { id: true, username: true, avatarColor: true, avatar: true, ...ROLE_FIELDS } } as const;
const OWNER = { id: true, username: true, profileVisibility: true, profileComments: true, bannedAt: true } as const;

type Owner = { id: string; username: string; profileVisibility: string; profileComments: string; bannedAt: Date | null };

/** Can this viewer write on the profile? Owners can always reply on their own (unless it's off). */
async function canWrite(owner: Owner, viewerId: string | null) {
  if (!viewerId || owner.profileComments === "off") return false;
  if (owner.profileComments === "everyone" || viewerId === owner.id) return true;
  const f = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: owner.id } }, select: { followerId: true } });
  return !!f;
}

/**
 * Comments people leave on someone's profile.
 * GET ?username=&before=     newest first, with what the viewer is allowed to do
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const me = await requireUserId();
  const owner = await prisma.user.findUnique({ where: { username: sp.get("username") ?? "" }, select: OWNER });
  if (!owner || (owner.bannedAt && owner.id !== me) || !(await canViewProfile(owner, me))) return fail("Profile not found", 404);
  if (owner.profileComments === "off") return NextResponse.json({ comments: [], next: null, off: true, canPost: false });

  const before = sp.get("before") && !Number.isNaN(Date.parse(sp.get("before")!)) ? new Date(sp.get("before")!) : null;
  const rows = await prisma.profileComment.findMany({
    where: { profileId: owner.id, user: { bannedAt: null }, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE,
    include: { user: PERSON },
  });
  const staff = me ? !!(await requireStaff()) : false;
  const isOwner = me === owner.id;
  return NextResponse.json(
    {
      comments: rows.map((c) => {
        const { id: authorId, ...author } = withRole(c.user);
        return { id: c.id, body: c.body, createdAt: c.createdAt, author, mine: authorId === me, canDelete: authorId === me || isOwner || staff, staffRemove: staff && authorId !== me && !isOwner };
      }),
      next: rows.length === PAGE ? rows.at(-1)!.createdAt.toISOString() : null,
      canPost: await canWrite(owner, me),
      followersOnly: owner.profileComments === "followers",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * POST { action: "create", username, body }
 *      { action: "delete", id }     your own comment, any comment on your profile, or (staff) any
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in first", 401);
  const b = await readJson<{ action: string; username: string; id: string; body: string }>(req);

  if (b.action === "create") {
    const owner = await prisma.user.findUnique({ where: { username: String(b.username ?? "") }, select: OWNER });
    if (!owner || owner.bannedAt || !(await canViewProfile(owner, userId))) return fail("Profile not found", 404);
    if (!(await canWrite(owner, userId))) return fail(owner.profileComments === "followers" ? `Only people who follow ${owner.username} can comment here` : "Comments are turned off on this profile", 403);
    const body = String(b.body ?? "").trim();
    if (!body || body.length > WALL_MAX) return fail(`Comments are 1–${WALL_MAX} characters`);
    // Content and account checks first, so blocked attempts don't use up the limits below.
    const problem = await checkWrite(userId, "profile_comment", body);
    if (problem) return fail(problem, writeStatus(problem));
    if (!rateLimit(`wall:${userId}`, 10, 10 * 60_000).ok) return fail("Slow down a little", 429);
    if (owner.id !== userId && !rateLimit(`wall:${userId}:${owner.id}`, 5, 10 * 60_000).ok) return fail(`You've left a few comments for ${owner.username} already — try again later`, 429);

    const c = await prisma.profileComment.create({ data: { profileId: owner.id, userId, body }, include: { user: PERSON } });
    if (owner.id !== userId) {
      await notify(owner.id, {
        type: "reply",
        title: `${c.user.username} commented on your profile`,
        body: body.replace(/\|\|[\s\S]*?\|\|/g, "▒▒▒").slice(0, 140),
        href: `/u/${owner.username}#wall-${c.id}`,
        key: `wall:${c.id}`,
      });
    }
    const { id: _id, ...author } = withRole(c.user);
    return NextResponse.json({ comment: { id: c.id, body: c.body, createdAt: c.createdAt, author, mine: true, canDelete: true, staffRemove: false } });
  }

  if (b.action === "delete") {
    const id = String(b.id ?? "");
    const c = await prisma.profileComment.findUnique({ where: { id }, include: { user: { select: { username: true } } } });
    if (!c) return fail("Comment not found", 404);
    if (c.userId === userId || c.profileId === userId) {
      await prisma.profileComment.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }
    const staff = await requireStaff();
    if (!staff) return fail("Comment not found", 404);
    await removeAndNotify("profile_comment", id);
    await logAdmin(staff.id, "Deleted profile comment", c.user.username, c.body.slice(0, 200));
    return NextResponse.json({ ok: true });
  }

  return fail("Unknown action");
}
