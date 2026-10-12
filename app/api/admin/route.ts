import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAdmin, revokeSessions } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { logAdmin } from "@/lib/admin";
import { notify } from "@/lib/notifications";
import { deleteAvatarFile } from "@/lib/uploads";

const TAGS = new Set(["new", "improved", "fixed"]);

/**
 * Moderation:  resolve | dismiss {reportId} (resolve deletes the content), deleteComment | deleteReview {id}
 * Users:       resetPassword {userId, password}, setAdmin {userId, value}, ban {userId, reason}, unban {userId},
 *              signOut {userId}, removeAvatar {userId}, deleteUser {userId, confirm: username}
 * Changelog:   changelogCreate {title, body, tag, version, notify}, changelogDelete {id}
 * System:      clearErrors
 * Every action is written to the audit log.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail("Admins only", 403);
  const b = await readJson<Record<string, unknown>>(req);
  const str = (k: string, max = 200) => String(b[k] ?? "").trim().slice(0, max);
  const log = (action: string, target = "", detail = "") => logAdmin(admin.id, action, target, detail);

  if (b.action === "resolve" || b.action === "dismiss") {
    const report = await prisma.report.findUnique({ where: { id: str("reportId") } });
    if (!report) return fail("Report not found", 404);
    if (b.action === "resolve") {
      if (report.targetType === "comment") await prisma.comment.deleteMany({ where: { id: report.targetId } });
      else await prisma.review.deleteMany({ where: { id: report.targetId } });
    }
    await prisma.report.updateMany({
      where: { targetType: report.targetType, targetId: report.targetId, status: "open" },
      data: { status: b.action === "resolve" ? "resolved" : "dismissed", resolvedAt: new Date(), resolvedById: admin.id },
    });
    await log(b.action === "resolve" ? "Removed reported content" : "Dismissed report", `${report.targetType} ${report.targetId}`, report.reason);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "deleteComment" || b.action === "deleteReview") {
    const id = str("id");
    if (b.action === "deleteComment") await prisma.comment.deleteMany({ where: { id } });
    else await prisma.review.deleteMany({ where: { id } });
    await log(b.action === "deleteComment" ? "Deleted comment" : "Deleted review", id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "clearErrors") {
    await prisma.errorLog.deleteMany({});
    await log("Cleared error log");
    return NextResponse.json({ ok: true });
  }

  if (b.action === "changelogCreate") {
    const title = str("title", 120);
    if (!title) return fail("Give the update a title");
    const tag = TAGS.has(str("tag")) ? str("tag") : "new";
    const entry = await prisma.changelogEntry.create({ data: { title, body: str("body", 4000), tag, version: str("version", 20), authorId: admin.id } });
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
  if (b.action === "changelogDelete") {
    const entry = await prisma.changelogEntry.findUnique({ where: { id: str("id") } });
    if (!entry) return fail("Not found", 404);
    await prisma.changelogEntry.delete({ where: { id: entry.id } });
    await log("Deleted changelog entry", entry.title);
    return NextResponse.json({ ok: true });
  }

  // ── User actions ──
  const user = await prisma.user.findUnique({ where: { id: str("userId") }, select: { id: true, username: true, isAdmin: true, avatar: true } });
  if (!user) return fail(b.userId ? "User not found" : "Unknown action", b.userId ? 404 : 400);
  const self = user.id === admin.id;

  switch (b.action) {
    case "resetPassword": {
      const password = String(b.password ?? "");
      if (password.length < 8) return fail("Password must be at least 8 characters");
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
      await revokeSessions(user.id);
      await log("Reset password", user.username);
      return NextResponse.json({ ok: true });
    }
    case "setAdmin": {
      if (self && b.value !== true) return fail("You can't remove your own admin access");
      await prisma.user.update({ where: { id: user.id }, data: { isAdmin: b.value === true } });
      await log(b.value === true ? "Granted admin" : "Removed admin", user.username);
      return NextResponse.json({ ok: true });
    }
    case "ban": {
      if (self) return fail("You can't ban yourself");
      if (user.isAdmin) return fail("Remove their admin access first");
      const reason = str("reason", 300);
      await prisma.user.update({ where: { id: user.id }, data: { bannedAt: new Date(), banReason: reason } });
      await revokeSessions(user.id);
      await log("Banned user", user.username, reason);
      return NextResponse.json({ ok: true });
    }
    case "removeAvatar": {
      await prisma.user.update({ where: { id: user.id }, data: { avatar: "" } });
      await deleteAvatarFile(user.avatar);
      await log("Removed profile picture", user.username);
      return NextResponse.json({ ok: true });
    }
    case "unban": {
      await prisma.user.update({ where: { id: user.id }, data: { bannedAt: null, banReason: "" } });
      await log("Unbanned user", user.username);
      return NextResponse.json({ ok: true });
    }
    case "signOut": {
      const current = self ? (await getSession())?.sid : undefined;
      const count = await revokeSessions(user.id, current);
      await log("Signed out everywhere", user.username, `${count} sessions`);
      return NextResponse.json({ ok: true, count });
    }
    case "deleteUser": {
      if (self) return fail("Delete your own account from Settings");
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
