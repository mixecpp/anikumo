import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkUsername, destroySession, getSession, revokeSessions, isOwnerName } from "@/lib/auth";
import { fail, readJson } from "@/lib/http";
import { isDiscordWebhook } from "@/lib/notifications";
import { encrypt } from "@/lib/crypto";
import { deleteAvatarFile } from "@/lib/uploads";
import { BANNER_URL, isVisibility, isWallSetting, serializeSections } from "@/lib/privacy-shared";
import { checkText } from "@/lib/automod";

type Body = {
  avatarColor: string; avatar: string;
  username: string;
  bio: string;
  profilePublic: boolean;
  profileVisibility: string;
  profileSections: Record<string, boolean>;
  searchable: boolean;
  onLeaderboard: boolean;
  allowFollows: boolean;
  profileComments: string;
  profileBanner: string;
  discordWebhook: string | null;
  currentPassword: string;
  newPassword: string;
};

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return fail("Not logged in", 401);
  const userId = session.userId;
  const body = await readJson<Body>(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const data: Record<string, unknown> = {};

  const needsPassword = body.newPassword !== undefined;
  if (needsPassword && !(await bcrypt.compare(String(body.currentPassword ?? ""), user.passwordHash))) {
    return fail("Current password is incorrect", 401);
  }

  if (body.avatarColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(body.avatarColor))) return fail("Invalid colour");
    data.avatarColor = String(body.avatarColor);
  }
  if (body.username !== undefined) {
    const username = String(body.username).trim();
    if (username !== user.username) {
      // Owner protection is tied to the name in ADMIN_USERNAMES, so owners keep their name.
      if (isOwnerName(user.username)) return fail("The site owner's username can't be changed", 403);
      const problem = await checkUsername(username, { exceptUserId: userId, rename: true });
      if (problem) return fail(problem, problem.includes("taken") ? 409 : 400);
      data.username = username;
    }
  }
  if (body.bio !== undefined) {
    const bio = String(body.bio).trim().slice(0, 300);
    const blocked = checkText(bio);
    if (blocked) return fail(blocked);
    data.bio = bio;
  }
  // Older clients send profilePublic; newer ones send profileVisibility. profilePublic always mirrors "everyone".
  if (body.profilePublic !== undefined) {
    data.profilePublic = body.profilePublic === true;
    data.profileVisibility = body.profilePublic === true ? "everyone" : "private";
  }
  if (body.profileVisibility !== undefined) {
    if (!isVisibility(body.profileVisibility)) return fail("Pick who can see your profile");
    data.profileVisibility = body.profileVisibility;
    data.profilePublic = body.profileVisibility === "everyone";
  }
  if (body.profileSections !== undefined) data.profileSections = serializeSections(body.profileSections);
  if (body.profileComments !== undefined) {
    if (!isWallSetting(body.profileComments)) return fail("Pick who can comment on your profile");
    data.profileComments = body.profileComments;
  }
  for (const key of ["searchable", "onLeaderboard", "allowFollows"] as const) {
    if (body[key] !== undefined) data[key] = body[key] === true;
  }
  if (body.profileBanner !== undefined) {
    const url = String(body.profileBanner ?? "").trim();
    if (url && (url.length > 300 || !BANNER_URL.test(url))) return fail("Pick a banner from an anime");
    data.profileBanner = url;
  }
  if (body.discordWebhook !== undefined) {
    const url = body.discordWebhook ? String(body.discordWebhook).trim() : "";
    if (url && !isDiscordWebhook(url)) return fail("That doesn't look like a Discord webhook URL");
    data.discordWebhook = url ? encrypt(url) : null;
  }

  let revoked = 0;
  if (body.newPassword !== undefined) {
    if (String(body.newPassword).length < 8) return fail("New password must be at least 8 characters");
    data.passwordHash = await bcrypt.hash(String(body.newPassword), 12);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { username: true, avatarColor: true, avatar: true, bio: true, profilePublic: true },
  });
  if (body.newPassword !== undefined) revoked = await revokeSessions(userId, session.sid);
  return NextResponse.json({ ok: true, user: updated, revokedSessions: revoked });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return fail("Not logged in", 401);
  const body = await readJson<{ password: string }>(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await bcrypt.compare(String(body.password ?? ""), user.passwordHash))) {
    return fail("Password is incorrect", 401);
  }
  if (isOwnerName(user.username)) return fail("The site owner account can't be deleted", 403);
  await destroySession();
  await deleteAvatarFile(user.avatar);
  await prisma.$transaction([
    prisma.watchTime.deleteMany({ where: { userId: session.userId } }),
    prisma.watchCursor.deleteMany({ where: { userId: session.userId } }),
    prisma.historyCutoff.deleteMany({ where: { userId: session.userId } }),
    prisma.user.delete({ where: { id: session.userId } }),
  ]);
  return NextResponse.json({ ok: true });
}
