import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, outranks, requireStaff, revokeSessions, roleOf } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { logAdmin } from "@/lib/admin";
import { notify } from "@/lib/notifications";
import { deleteAvatarFile } from "@/lib/uploads";
import { isReportable, removeAndNotify } from "@/lib/reports";

const TAGS = new Set(["new", "improved", "fixed"]);
const ROLE_NAME = { owner: "the site owner", admin: "an admin", moderator: "a moderator", user: "this user" } as const;

/**
 * Staff actions. Who can do what:
 *
 * Moderators, admins, owners
 *   resolve | dismiss {reportId}             resolve removes the reported content
 *   deleteComment | deleteReview | deletePost | deletePostComment {id}
 *   mute {userId, minutes, reason}           minutes 0 lifts it (moderators: 7 days at most)
 *   request {userId, kind, reason}           ask an admin to ban, clear bio/banner or remove picture
 *   …and only on people ranked below them (owner > admin > moderator > user).
 *
 * Admins and owners
 *   ban {userId, reason} | unban {userId}, clearProfile {userId}, removeAvatar {userId}
 *   approveRequest | denyRequest {requestId}
 *   setModerator {userId, value}, resetPassword {userId, password}, signOut {userId},
 *   deleteUser {userId, confirm}, changelogCreate | changelogDelete, clearErrors
 *
 * Owners only
 *   setAdmin {userId, value}
 *
 * Owners (ADMIN_USERNAMES) can't be demoted, banned, muted, reset, signed out or deleted by anyone.
 * Every action is written to the audit log.
 */
export async function POST(req: Request) {
  const actor = await requireStaff();
  if (!actor) return fail("Staff only", 403);
  const isAdmin = actor.role === "admin" || actor.role === "owner";
  const b = await readJson<Record<string, unknown>>(req);
  const str = (k: string, max = 200) => String(b[k] ?? "").trim().slice(0, max);
  const log = (action: string, target = "", detail = "") => logAdmin(actor.id, action, target, detail);

  // ── Content ──
  if (b.action === "resolve" || b.action === "dismiss") {
    const report = await prisma.report.findUnique({ where: { id: str("reportId") } });
    if (!report) return fail("Report not found", 404);
    if (b.action === "resolve" && isReportable(report.targetType)) await removeAndNotify(report.targetType, report.targetId, report.reason);
    await prisma.report.updateMany({
      where: { targetType: report.targetType, targetId: report.targetId, status: "open" },
      data: { status: b.action === "resolve" ? "resolved" : "dismissed", resolvedAt: new Date(), resolvedById: actor.id },
    });
    await log(b.action === "resolve" ? "Removed reported content" : "Dismissed report", `${report.targetType} ${report.targetId}`, report.reason);
    return NextResponse.json({ ok: true });
  }
  const CONTENT = { deleteComment: "comment", deleteReview: "review", deletePost: "post", deletePostComment: "post_comment" } as const;
  if (typeof b.action === "string" && b.action in CONTENT) {
    const type = CONTENT[b.action as keyof typeof CONTENT];
    await removeAndNotify(type, str("id"), str("reason", 200));
    await log(`Deleted ${type.replace("_", " ")}`, str("id"));
    return NextResponse.json({ ok: true });
  }

  // ── Site (admins only) ──
  if (b.action === "clearErrors" || b.action === "changelogCreate" || b.action === "changelogDelete") {
    if (!isAdmin) return fail("Admins only", 403);
    if (b.action === "clearErrors") {
      await prisma.errorLog.deleteMany({});
      await log("Cleared error log");
      return NextResponse.json({ ok: true });
    }
    if (b.action === "changelogCreate") {
      const title = str("title", 120);
      if (!title) return fail("Give the update a title");
      const tag = TAGS.has(str("tag")) ? str("tag") : "new";
      const entry = await prisma.changelogEntry.create({ data: { title, body: str("body", 4000), tag, version: str("version", 20), authorId: actor.id } });
      let notified = 0;
      if (b.notify === true) {
        const users = await prisma.user.findMany({ where: { bannedAt: null }, select: { id: true } });
        for (const u of users) {
          await notify(u.id, { type: "system", title: `What's new: ${title}`, body: entry.body.slice(0, 200), href: `/changelog#${entry.id}`, key: `changelog:${entry.id}` });
        }
        notified = users.length;
      }
      await log("Posted changelog", title, notified ? `notified ${notified} users` : "");
      return NextResponse.json({ ok: true, entry, notified });
    }
    const entry = await prisma.changelogEntry.findUnique({ where: { id: str("id") } });
    if (!entry) return fail("Not found", 404);
    await prisma.changelogEntry.delete({ where: { id: entry.id } });
    await log("Deleted changelog entry", entry.title);
    return NextResponse.json({ ok: true });
  }

  // ── Requests from moderators (admins decide) ──
  if (b.action === "approveRequest" || b.action === "denyRequest") {
    if (!isAdmin) return fail("Admins only", 403);
    const request = await prisma.modRequest.findUnique({ where: { id: str("requestId") }, include: { target: { select: { id: true, username: true, isAdmin: true, isModerator: true, avatar: true } } } });
    if (!request) return fail("Request not found", 404);
    if (request.status !== "open") return fail("That request was already handled");
    if (b.action === "approveRequest") {
      if (!outranks(actor, request.target)) return fail(`You can't do that to ${ROLE_NAME[roleOf(request.target)]}`, 403);
      await applyAction(request.kind as RequestKind, request.target, request.reason);
    }
    const approved = b.action === "approveRequest";
    await prisma.modRequest.update({ where: { id: request.id }, data: { status: approved ? "approved" : "denied", handledById: actor.id, handledAt: new Date() } });
    await notify(request.requesterId, {
      type: "system",
      title: `Your ${KIND_LABEL[request.kind as RequestKind] ?? "request"} for ${request.target.username} was ${approved ? "approved" : "declined"}`,
      href: "/admin/moderation?tab=requests",
      key: `modreq:${request.id}:${approved ? "ok" : "no"}`,
    });
    await log(approved ? "Approved request" : "Declined request", request.target.username, KIND_LABEL[request.kind as RequestKind] ?? request.kind);
    return NextResponse.json({ ok: true });
  }

  // ── People ──
  const user = await prisma.user.findUnique({ where: { id: str("userId") }, select: { id: true, username: true, isAdmin: true, isModerator: true, avatar: true } });
  if (!user) return fail(b.userId ? "User not found" : "Unknown action", b.userId ? 404 : 400);
  const self = user.id === actor.id;
  const targetRole = roleOf(user);
  // Everything below needs you to rank above them (owner > admin > moderator > user).
  const guard = (allowSelf = false) => {
    if (self && allowSelf) return null;
    if (self) return fail("You can't do that to yourself", 400);
    if (!outranks(actor, user)) return fail(`You can't do that to ${ROLE_NAME[targetRole]}`, 403);
    return null;
  };
  const adminOnly = () => (isAdmin ? null : fail("Admins only", 403));

  switch (b.action) {
    case "request": {
      const blocked = guard();
      if (blocked) return blocked;
      const kind = str("kind") as RequestKind;
      if (!(kind in KIND_LABEL)) return fail("Unknown request");
      const reason = str("reason", 300);
      if (kind === "ban" && !reason) return fail("Say why they should be banned");
      const open = await prisma.modRequest.findFirst({ where: { kind, targetId: user.id, status: "open" } });
      if (open) return fail("There's already an open request for that");
      const request = await prisma.modRequest.create({ data: { kind, targetId: user.id, requesterId: actor.id, reason } });
      const admins = await prisma.user.findMany({ where: { isAdmin: true, bannedAt: null }, select: { id: true } });
      for (const a of admins) {
        await notify(a.id, {
          type: "system",
          title: `${actor.username} asks you to ${KIND_VERB[kind]} ${user.username}`,
          body: reason.slice(0, 200),
          href: "/admin/moderation?tab=requests",
          key: `modreq:${request.id}:${a.id}`,
        });
      }
      await log("Sent request", user.username, `${KIND_LABEL[kind]}${reason ? ` · ${reason}` : ""}`);
      return NextResponse.json({ ok: true });
    }
    case "ban": {
      const blocked = adminOnly() ?? guard();
      if (blocked) return blocked;
      await applyAction("ban", user, str("reason", 300));
      await log("Banned user", user.username, str("reason", 300));
      return NextResponse.json({ ok: true });
    }
    case "unban": {
      const blocked = adminOnly() ?? guard();
      if (blocked) return blocked;
      await prisma.user.update({ where: { id: user.id }, data: { bannedAt: null, banReason: "" } });
      await notify(user.id, { type: "system", title: "Your account was reinstated", body: "Welcome back. Please keep to the community rules.", key: `unban:${user.id}:${Date.now()}` });
      await log("Unbanned user", user.username);
      return NextResponse.json({ ok: true });
    }
    case "mute": {
      const blocked = guard();
      if (blocked) return blocked;
      // Moderators can mute for up to a week; longer is an admin call.
      const max = isAdmin ? 60 * 24 * 30 : 60 * 24 * 7;
      if (Number(b.minutes) > max) return fail(isAdmin ? "30 days at most" : "Moderators can mute for 7 days at most — ask an admin for longer");
      const minutes = Math.min(max, Math.max(0, Math.round(Number(b.minutes) || 0)));
      const reason = str("reason", 300);
      const until = minutes ? new Date(Date.now() + minutes * 60_000) : null;
      await prisma.user.update({ where: { id: user.id }, data: { mutedUntil: until, muteReason: until ? reason : "" } });
      if (until) {
        const span = minutes >= 1440 ? `${Math.round(minutes / 1440)} day${minutes >= 2880 ? "s" : ""}` : minutes >= 60 ? `${Math.round(minutes / 60)} hour${minutes >= 120 ? "s" : ""}` : `${minutes} minutes`;
        await notify(user.id, { type: "system", title: `A moderator muted you for ${span}`, body: reason || "You can still watch, but can't post or comment until it ends. Please read the rules.", key: `mute:${user.id}:${Date.now()}` });
      }
      await log(until ? "Muted user" : "Unmuted user", user.username, until ? `${minutes} min${reason ? ` · ${reason}` : ""}` : "");
      return NextResponse.json({ ok: true, mutedUntil: until });
    }
    case "clearProfile":
    case "removeAvatar": {
      const blocked = adminOnly() ?? guard(true);
      if (blocked) return blocked;
      await applyAction(b.action, user, "");
      await log(b.action === "clearProfile" ? "Cleared profile bio and banner" : "Removed profile picture", user.username);
      return NextResponse.json({ ok: true });
    }
    case "setModerator": {
      const blocked = adminOnly() ?? guard();
      if (blocked) return blocked;
      await prisma.user.update({ where: { id: user.id }, data: { isModerator: b.value === true } });
      await log(b.value === true ? "Made moderator" : "Removed moderator", user.username);
      return NextResponse.json({ ok: true });
    }
    case "setAdmin": {
      if (actor.role !== "owner") return fail("Only the site owner can change admins", 403);
      const blocked = guard();
      if (blocked) return blocked;
      await prisma.user.update({ where: { id: user.id }, data: { isAdmin: b.value === true, ...(b.value === true ? { isModerator: false } : {}) } });
      await log(b.value === true ? "Granted admin" : "Removed admin", user.username);
      return NextResponse.json({ ok: true });
    }
    case "resetPassword": {
      const blocked = adminOnly() ?? guard();
      if (blocked) return blocked;
      const password = String(b.password ?? "");
      if (password.length < 8) return fail("Password must be at least 8 characters");
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
      await revokeSessions(user.id);
      await log("Reset password", user.username);
      return NextResponse.json({ ok: true });
    }
    case "signOut": {
      const blocked = adminOnly() ?? guard(true);
      if (blocked) return blocked;
      const current = self ? (await getSession())?.sid : undefined;
      const count = await revokeSessions(user.id, current);
      await log("Signed out everywhere", user.username, `${count} sessions`);
      return NextResponse.json({ ok: true, count });
    }
    case "deleteUser": {
      const blocked = adminOnly() ?? guard();
      if (blocked) return blocked;
      if (user.isAdmin) return fail("Remove their admin access first");
      if (str("confirm") !== user.username) return fail("Type the username to confirm");
      await deleteAvatarFile(user.avatar);
      await prisma.$transaction([
        prisma.watchTime.deleteMany({ where: { userId: user.id } }),
        prisma.watchCursor.deleteMany({ where: { userId: user.id } }),
        prisma.historyCutoff.deleteMany({ where: { userId: user.id } }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);
      await log("Deleted user", user.username);
      return NextResponse.json({ ok: true });
    }
  }
  return fail("Unknown action");
}

type RequestKind = "ban" | "clearProfile" | "removeAvatar";
const KIND_LABEL: Record<RequestKind, string> = { ban: "ban request", clearProfile: "bio and banner removal", removeAvatar: "picture removal" };
const KIND_VERB: Record<RequestKind, string> = { ban: "ban", clearProfile: "clear the bio and banner of", removeAvatar: "remove the picture of" };

/** The actions moderators can ask for; admins run them directly or by approving a request. */
async function applyAction(kind: RequestKind, user: { id: string; avatar: string }, reason: string) {
  if (kind === "ban") {
    await prisma.user.update({ where: { id: user.id }, data: { bannedAt: new Date(), banReason: reason, isModerator: false } });
    await revokeSessions(user.id);
  } else if (kind === "clearProfile") {
    await prisma.user.update({ where: { id: user.id }, data: { bio: "", profileBanner: "" } });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { avatar: "" } });
    await deleteAvatarFile(user.avatar);
  }
  // Tell them what happened (a banned person sees it if they're ever let back in; the login page shows the ban reason).
  await notify(user.id, {
    type: "system",
    title: kind === "ban" ? "Your account was suspended" : kind === "clearProfile" ? "A moderator cleared your bio and banner" : "A moderator removed your profile picture",
    body: kind === "ban" ? reason : "They didn't fit the community rules. You're welcome to set new ones that do.",
    key: `punish:${kind}:${user.id}:${Date.now()}`,
  });
}
