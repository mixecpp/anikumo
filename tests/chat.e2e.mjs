// Live chat and announcements (the floating chat on every page).
// Usage: npm run test:chat   (dev server on http://localhost:8080; override with BASE_URL)
// Creates throwaway accounts and deletes them (and their messages) afterwards.
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
const slur = ["ni", "gger"].join("");

function client(xff = ip(), ua = `Mozilla/5.0 chat-test ${randomUUID()}`) {
  let cookie = "";
  return async (method, path, body) => {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", "X-Forwarded-For": xff, "User-Agent": ua, ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
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

const ids = [];
async function makeUser(tag, data = {}) {
  const username = `ch${tag}_${stamp}`;
  const password = randomUUID();
  const u = await prisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 4), createdAt: new Date(Date.now() - 5 * DAY), ...data } });
  ids.push(u.id);
  const c = client();
  const login = await c("POST", "/api/auth/login", { username, password, captcha: CAPTCHA });
  assert.equal(login.status, 200, `login ${username}: ${login.text}`);
  return { ...u, c };
}
const chat = (c, body) => c("POST", "/api/live/chat", body);

test("live chat and announcements", async (t) => {
  try {
    const alice = await makeUser("ali");
    const bob = await makeUser("bob");
    const mod = await makeUser("mod", { isModerator: true });
    const admin = await makeUser("adm", { isAdmin: true });
    const guest = client();
    let first;
    // A run that failed half way can leave the chat paused or in slow mode.
    assert.equal((await chat(mod.c, { action: "settings", on: true, slowMode: 0 })).status, 200);

    await t.test("guests can read and count as online, but must log in to send", async () => {
      const poll = await guest("GET", "/api/live?open=1");
      assert.equal(poll.status, 200, poll.text);
      assert.ok(poll.json.online >= 1);
      assert.equal(poll.json.me, null);
      assert.ok(Array.isArray(poll.json.chat.messages));
      assert.equal((await chat(guest, { action: "send", body: "hello" })).status, 401);
    });

    await t.test("messages go out, with the language filter and length limit", async () => {
      const r = await chat(alice.c, { action: "send", body: `hello everyone ${stamp}` });
      assert.equal(r.status, 200, r.text);
      first = r.json.message;
      assert.equal(first.author.username, alice.username);
      assert.equal(first.author.role, "user");
      assert.equal(first.author.isAdmin, undefined, "no raw staff flags");
      assert.equal((await chat(alice.c, { action: "send", body: `you ${slur}` })).status, 400);
      assert.equal((await chat(alice.c, { action: "send", body: "x".repeat(401) })).status, 400);
      assert.equal((await chat(alice.c, { action: "send", body: "   " })).status, 400);
      const poll = await bob.c("GET", "/api/live?open=1");
      assert.ok(poll.json.chat.messages.some((m) => m.id === first.id));
      assert.ok(poll.json.chat.latestAt >= Date.parse(first.createdAt));
      assert.equal(poll.json.me.username, bob.username);
    });

    await t.test("replies and shared episodes use server data", async () => {
      const r = await chat(bob.c, { action: "send", body: `@${alice.username} hi!`, replyToId: first.id, anime: { id: 21, episode: 5, title: "fake title", cover: "https://evil.example/x.png" } });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.message.replyTo.id, first.id);
      assert.equal(r.json.message.replyTo.username, alice.username);
      assert.equal(r.json.message.anime.id, 21);
      assert.equal(r.json.message.anime.episode, 5);
      assert.notEqual(r.json.message.anime.title, "fake title");
      assert.ok(!r.json.message.anime.cover.includes("evil.example"));
    });

    await t.test("polling with since returns only new messages and deletions", async () => {
      const since = new Date().toISOString();
      const r = await chat(alice.c, { action: "send", body: `second ${stamp}` });
      const next = await bob.c("GET", `/api/live?open=1&since=${encodeURIComponent(since)}`);
      assert.ok(next.json.chat.messages.some((m) => m.id === r.json.message.id));
      assert.equal((await chat(bob.c, { action: "delete", id: r.json.message.id })).status, 404, "cannot delete another person's message");
      assert.equal((await chat(alice.c, { action: "delete", id: r.json.message.id })).status, 200);
      const after = await bob.c("GET", `/api/live?open=1&since=${encodeURIComponent(since)}`);
      assert.ok(after.json.chat.deleted.includes(r.json.message.id));
      assert.ok(!after.json.chat.messages.some((m) => m.id === r.json.message.id));
      const older = await guest("GET", `/api/live/chat?before=${first.id}`);
      assert.equal(older.status, 200);
    });

    await t.test("reports and moderators", async () => {
      const rep = await bob.c("POST", "/api/reports", { targetType: "chat_message", targetId: first.id, reason: "spam" });
      assert.equal(rep.status, 200, rep.text);
      assert.equal((await chat(bob.c, { action: "pin", id: first.id })).status, 403);
      assert.equal((await chat(mod.c, { action: "pin", id: first.id })).status, 200);
      const poll = await guest("GET", "/api/live?open=1");
      assert.equal(poll.json.chat.pinned?.id, first.id);
      assert.equal((await chat(mod.c, { action: "unpin" })).status, 200);
      assert.equal((await chat(bob.c, { action: "settings", on: false })).status, 403);
      assert.equal((await chat(mod.c, { action: "clear" })).status, 403, "only admins clear the chat");
    });

    await t.test("pausing the chat and slow mode", async () => {
      assert.equal((await chat(mod.c, { action: "settings", on: false })).status, 200);
      assert.equal((await chat(alice.c, { action: "send", body: `paused ${stamp}` })).status, 403);
      assert.equal((await chat(mod.c, { action: "send", body: `staff can still talk ${stamp}` })).status, 200);
      assert.equal((await chat(mod.c, { action: "settings", on: true, slowMode: 30 })).status, 200);
      assert.equal((await chat(mod.c, { action: "settings", slowMode: 7 })).status, 400, "only the listed slow modes");
      const carl = await makeUser("crl");
      assert.equal((await chat(carl.c, { action: "send", body: `slow one ${stamp}` })).status, 200);
      const again = await chat(carl.c, { action: "send", body: `slow two ${stamp}` });
      assert.equal(again.status, 429);
      assert.match(again.json.error, /slow mode/i);
      const poll = await carl.c("GET", "/api/live");
      assert.ok(poll.json.me.slowWait > 0);
      assert.equal(poll.json.chat.slowMode, 30);
      assert.equal((await chat(mod.c, { action: "settings", slowMode: 0 })).status, 200);
    });

    await t.test("muted people can read but not send", async () => {
      await prisma.user.update({ where: { id: alice.id }, data: { mutedUntil: new Date(Date.now() + 3600_000) } });
      const poll = await alice.c("GET", "/api/live");
      assert.equal(poll.json.me.muted, true);
      assert.equal((await chat(alice.c, { action: "send", body: `muted ${stamp}` })).status, 403);
      await prisma.user.update({ where: { id: alice.id }, data: { mutedUntil: null } });
    });

    await t.test("announcements: admins only, shown to everyone, can end early", async () => {
      assert.equal((await mod.c("POST", "/api/admin/announcements", { action: "create", body: "hi", duration: "1h" })).status, 404);
      assert.equal((await admin.c("POST", "/api/admin/announcements", { action: "create", body: "x", href: "javascript:alert(1)", duration: "1h" })).status, 400);
      assert.equal((await admin.c("POST", "/api/admin/announcements", { action: "create", body: "x", duration: "2y" })).status, 400);
      const r = await admin.c("POST", "/api/admin/announcements", { action: "create", body: `New episodes tonight ${stamp}`, href: "/schedule", tone: "important", duration: "1h" });
      assert.equal(r.status, 200, r.text);
      const poll = await guest("GET", "/api/live");
      assert.equal(poll.json.announcement?.id, r.json.id);
      assert.equal(poll.json.announcement.tone, "important");
      assert.equal(poll.json.announcement.href, "/schedule");
      assert.equal((await admin.c("POST", "/api/admin/announcements", { action: "end", id: r.json.id })).status, 200);
      const after = await guest("GET", "/api/live");
      assert.notEqual(after.json.announcement?.id, r.json.id);
    });

    await t.test("staff can remove everything someone sent", async () => {
      const r = await chat(mod.c, { action: "purge", userId: bob.id });
      assert.equal(r.status, 200, r.text);
      assert.ok(r.json.removed >= 1);
      assert.equal(await prisma.chatMessage.count({ where: { userId: bob.id } }), 0);
    });

    await t.test("the online list and home page", async () => {
      const r = await guest("GET", "/api/live/online");
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.json.users) && Array.isArray(r.json.rooms));
      const home = await guest("GET", "/");
      assert.equal(home.status, 200);
      assert.match(home.text, /Live on AniKumo/);
    });
  } finally {
    await prisma.siteSetting.deleteMany({ where: { key: "chat" } });
    await prisma.announcement.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.report.deleteMany({ where: { reporterId: { in: ids } } });
    await prisma.chatMessage.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
