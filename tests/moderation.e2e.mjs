// Staff roles, moderation tools, owner protection, spam limits and the login captcha.
// Usage: npm run test:moderation   (dev server on http://localhost:8080; override with BASE_URL)
// Creates throwaway accounts in the database and deletes them afterwards. The site owner (from
// ADMIN_USERNAMES) is only ever sent harmless requests that must be refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const CAPTCHA = "XXXX.DUMMY.TOKEN.XXXX";
const prisma = new PrismaClient();
const ip = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
const stamp = Date.now().toString(36).slice(-6);
const DAY = 86_400_000;

function client(xff = ip()) {
  let cookie = "";
  return async (method, path, body) => {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", "X-Forwarded-For": xff, ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const m = res.headers.get("set-cookie")?.match(/aw_session=([^;]*)/);
    if (m) cookie = `aw_session=${m[1]}`;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text };
  };
}
const isNotFound = (r) => r.status === 404 || r.text.includes("NEXT_HTTP_ERROR_FALLBACK;404");

const ids = [];
async function makeUser(tag, data = {}) {
  const username = `md${tag}_${stamp}`;
  const password = randomUUID();
  const u = await prisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 4), profilePublic: true, profileVisibility: "everyone", createdAt: new Date(Date.now() - 5 * DAY), ...data } });
  ids.push(u.id);
  const c = client();
  const login = await c("POST", "/api/auth/login", { username, password, captcha: CAPTCHA });
  assert.equal(login.status, 200, `login ${username}: ${login.text}`);
  return { ...u, password, c };
}

test("moderation", async (t) => {
  try {
    const admin = await makeUser("adm", { isAdmin: true });
    const mod = await makeUser("mod", { isModerator: true });
    const mod2 = await makeUser("mo2", { isModerator: true });
    const user = await makeUser("usr");
    const fresh = await makeUser("new", { createdAt: new Date() });
    const owner = await prisma.user.findFirst({ where: { username: "mixe" }, select: { id: true } });

    await t.test("captcha is required to log in", async () => {
      const r = await client()("POST", "/api/auth/login", { username: user.username, password: user.password });
      assert.equal(r.status, 400);
      assert.match(r.json.error, /human check/);
    });

    await t.test("moderators can't reach admin pages or site controls", async () => {
      assert.ok(isNotFound(await mod.c("GET", "/admin")), "no overview / metrics page");
      assert.ok(isNotFound(await mod.c("GET", "/admin/users")));
      assert.ok(isNotFound(await mod.c("GET", "/admin/system")));
      assert.ok(isNotFound(await mod.c("GET", "/admin/changelog")));
      assert.equal((await mod.c("GET", "/api/admin/metrics")).status, 403);
      assert.equal((await mod.c("GET", "/api/admin/users")).status, 403);
      const page = await mod.c("GET", "/admin/moderation");
      assert.equal(page.status, 200);
      assert.match(page.text, /mute people for up to a week/);
      assert.equal((await mod.c("POST", "/api/admin", { action: "changelogCreate", title: "nope" })).status, 403);
      assert.equal((await mod.c("POST", "/api/admin", { action: "clearErrors" })).status, 403);
      assert.equal((await mod.c("POST", "/api/admin", { action: "setModerator", userId: user.id, value: true })).status, 403);
      assert.equal((await mod.c("POST", "/api/admin", { action: "resetPassword", userId: user.id, password: "long-enough-pw" })).status, 403);
      assert.ok(isNotFound(await user.c("GET", "/admin/moderation")), "regular users get nothing");
      assert.equal((await user.c("POST", "/api/admin", { action: "mute", userId: mod.id, minutes: 10 })).status, 403);
    });

    await t.test("rank rules: nobody acts on equals or people above them", async () => {
      assert.equal((await mod.c("POST", "/api/admin", { action: "ban", userId: mod2.id, reason: "x" })).status, 403, "mod can't ban a mod");
      assert.equal((await mod.c("POST", "/api/admin", { action: "mute", userId: admin.id, minutes: 10 })).status, 403, "mod can't mute an admin");
      assert.equal((await admin.c("POST", "/api/admin", { action: "setAdmin", userId: user.id, value: true })).status, 403, "only the owner makes admins");
      assert.equal((await admin.c("POST", "/api/admin", { action: "setModerator", userId: user.id, value: true })).status, 200, "admins make mods");
      assert.equal((await admin.c("POST", "/api/admin", { action: "setModerator", userId: user.id, value: false })).status, 200);
      if (owner) {
        // Harmless requests only: if the guard failed these would change nothing anyway.
        for (const [who, c] of [["admin", admin.c], ["mod", mod.c]]) {
          assert.equal((await c("POST", "/api/admin", { action: "mute", userId: owner.id, minutes: 0 })).status, 403, `${who} can't touch the owner`);
          assert.equal((await c("POST", "/api/admin", { action: "setModerator", userId: owner.id, value: false })).status, 403);
        }
      }
    });

    await t.test("mute: muted people can't post, and are told", async () => {
      assert.equal((await mod.c("POST", "/api/admin", { action: "mute", userId: user.id, minutes: 60, reason: "cool off" })).status, 200);
      const c = await user.c("POST", "/api/comments", { anilistId: 21, episode: 1, body: "can I talk" });
      assert.equal(c.status, 403);
      assert.match(c.json.error, /muted/);
      assert.equal((await user.c("POST", "/api/posts", { action: "create", body: "hello" })).status, 403);
      assert.ok(await prisma.notification.findFirst({ where: { userId: user.id, title: { contains: "muted you" } } }));
      assert.equal((await mod.c("POST", "/api/admin", { action: "mute", userId: user.id, minutes: 0 })).status, 200);
      assert.equal((await user.c("POST", "/api/comments", { anilistId: 21, episode: 1, body: `back again ${stamp}` })).status, 200);
    });

    await t.test("reports on posts and post comments reach the queue; mods remove them", async () => {
      const post = (await user.c("POST", "/api/posts", { action: "create", body: `report me ${stamp}` })).json.post;
      const comment = (await user.c("POST", "/api/posts", { action: "comment", id: post.id, body: `and me ${stamp}` })).json.comment;
      assert.equal((await mod.c("POST", "/api/reports", { targetType: "post", targetId: post.id, reason: "spam" })).status, 200);
      assert.equal((await mod.c("POST", "/api/reports", { targetType: "post_comment", targetId: comment.id, reason: "harassment" })).status, 200);
      assert.equal((await user.c("POST", "/api/reports", { targetType: "post", targetId: post.id, reason: "spam" })).status, 400, "can't report yourself");
      const queue = await mod.c("GET", "/admin/moderation");
      assert.match(queue.text, new RegExp(`report me ${stamp}`));
      const report = await prisma.report.findFirst({ where: { targetId: post.id, status: "open" } });
      assert.equal((await mod.c("POST", "/api/admin", { action: "resolve", reportId: report.id })).status, 200);
      assert.equal(await prisma.post.count({ where: { id: post.id } }), 0, "resolving removes the post");
      assert.ok(await prisma.notification.findFirst({ where: { userId: user.id, title: { contains: "removed your post for spam" } } }), "author told why");
      // Mods can also delete directly, from the post itself.
      const p2 = (await user.c("POST", "/api/posts", { action: "create", body: `second ${stamp}` })).json.post;
      const listed = await mod.c("GET", `/api/posts?username=${user.username}`);
      assert.equal(listed.json.staff, true, "the UI gets a moderator flag");
      assert.equal((await mod.c("POST", "/api/posts", { action: "delete", id: p2.id })).status, 200);
      assert.equal((await user.c("GET", `/api/posts?username=${user.username}`)).json.staff, false);
    });

    await t.test("mods can remove anyone's episode comments", async () => {
      const c = (await user.c("POST", "/api/comments", { anilistId: 21, episode: 2, body: `remove this ${stamp}` })).json.comment;
      assert.equal((await mod2.c("GET", "/api/comments?anilistId=21&episode=2")).json.staff, true);
      assert.equal((await fresh.c("DELETE", `/api/comments?id=${c.id}`)).status, 404, "regular users can't");
      assert.equal((await mod2.c("DELETE", `/api/comments?id=${c.id}`)).status, 200);
      const log = await prisma.adminLog.findFirst({ where: { adminId: mod2.id, action: "Deleted comment" } });
      assert.ok(log, "it's in the audit log");
      assert.ok(await prisma.notification.findFirst({ where: { userId: user.id, title: { contains: "removed your comment" } } }), "the author is told");
    });

    await t.test("moderators request bans and profile clean-ups; admins decide", async () => {
      assert.equal((await mod.c("POST", "/api/admin", { action: "ban", userId: user.id, reason: "spam" })).status, 403, "mods can't ban directly");
      assert.equal((await mod.c("POST", "/api/admin", { action: "clearProfile", userId: user.id })).status, 403);
      assert.equal((await mod.c("POST", "/api/admin", { action: "removeAvatar", userId: user.id })).status, 403);
      assert.equal((await mod.c("POST", "/api/admin", { action: "mute", userId: user.id, minutes: 60 * 24 * 8 })).status, 400, "mods mute for 7 days at most");
      assert.equal((await mod.c("POST", "/api/admin", { action: "request", userId: user.id, kind: "ban", reason: "" })).status, 400, "ban requests need a reason");
      assert.equal((await mod.c("POST", "/api/admin", { action: "request", userId: user.id, kind: "ban", reason: "spamming links" })).status, 200);
      assert.equal((await mod.c("POST", "/api/admin", { action: "request", userId: user.id, kind: "ban", reason: "again" })).status, 400, "no duplicate open requests");
      assert.equal((await mod.c("POST", "/api/admin", { action: "request", userId: admin.id, kind: "ban", reason: "x" })).status, 403, "can't request against higher ranks");
      assert.ok(await prisma.notification.findFirst({ where: { userId: admin.id, title: { contains: "asks you to ban" } } }), "admins are told");
      const req = await prisma.modRequest.findFirst({ where: { targetId: user.id, status: "open" } });
      assert.equal((await mod.c("POST", "/api/admin", { action: "approveRequest", requestId: req.id })).status, 403, "mods can't approve");
      assert.match((await mod.c("GET", "/admin/moderation?tab=requests")).text, /spamming links/);
      assert.equal((await admin.c("POST", "/api/admin", { action: "approveRequest", requestId: req.id })).status, 200);
      assert.ok((await prisma.user.findUnique({ where: { id: user.id } })).bannedAt, "approving runs the ban");
      assert.ok(await prisma.notification.findFirst({ where: { userId: user.id, title: "Your account was suspended" } }));
      assert.ok(await prisma.notification.findFirst({ where: { userId: mod.id, title: { contains: "was approved" } } }), "the mod hears back");
      assert.equal((await admin.c("POST", "/api/admin", { action: "unban", userId: user.id })).status, 200);
      // a declined request changes nothing
      await prisma.user.update({ where: { id: user.id }, data: { bio: "keep me" } });
      assert.equal((await mod.c("POST", "/api/admin", { action: "request", userId: user.id, kind: "clearProfile", reason: "rude bio" })).status, 200);
      const req2 = await prisma.modRequest.findFirst({ where: { targetId: user.id, kind: "clearProfile", status: "open" } });
      assert.equal((await admin.c("POST", "/api/admin", { action: "denyRequest", requestId: req2.id })).status, 200);
      assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).bio, "keep me");
    });

    await t.test("ban and unban (admins)", async () => {
      assert.equal((await admin.c("POST", "/api/admin", { action: "ban", userId: user.id, reason: "spam" })).status, 200);
      assert.equal((await client()("POST", "/api/auth/login", { username: user.username, password: user.password, captcha: CAPTCHA })).status, 403);
      assert.equal((await admin.c("POST", "/api/admin", { action: "unban", userId: user.id })).status, 200);
      assert.equal((await client()("POST", "/api/auth/login", { username: user.username, password: user.password, captcha: CAPTCHA })).status, 200);
    });

    await t.test("spam protection", async () => {
      const re = await client()("POST", "/api/auth/login", { username: user.username, password: user.password, captcha: CAPTCHA });
      void re;
      const u = await makeUser("spm");
      assert.match((await u.c("POST", "/api/posts", { action: "create", body: "you're a f a g g o t" })).json.error, /isn't allowed/);
      assert.match((await u.c("POST", "/api/comments", { anilistId: 21, episode: 1, body: "kys loser" })).json.error, /harassment/);
      assert.equal((await u.c("POST", "/api/posts", { action: "create", body: `same thing ${stamp}` })).status, 200);
      assert.match((await u.c("POST", "/api/posts", { action: "create", body: `Same thing ${stamp}!` })).json.error, /just posted that/);
      assert.match((await u.c("POST", "/api/posts", { action: "create", body: "join discord.gg/abc" })).json.error, /Invite/);
      // 8 writes a minute, then slow down
      let last;
      for (let i = 0; i < 9; i++) last = await u.c("POST", "/api/comments", { anilistId: 21, episode: 3, body: `flood ${i} ${stamp}` });
      assert.equal(last.status, 429);
      // brand-new accounts: one post every 20 seconds, no links
      assert.equal((await fresh.c("POST", "/api/comments", { anilistId: 21, episode: 4, body: `hello ${stamp}` })).status, 200);
      const again = await fresh.c("POST", "/api/comments", { anilistId: 21, episode: 4, body: `hello again ${stamp}` });
      assert.equal(again.status, 429);
      assert.match(again.json.error, /New accounts/);
      assert.equal((await mod.c("PATCH", "/api/account", { bio: "n i g g e r" })).status, 400, "bios are filtered");
      assert.equal((await mod.c("PATCH", "/api/account", { profileBanner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/" + "a".repeat(400) + ".jpg" })).status, 400, "banner URLs are capped");
    });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
