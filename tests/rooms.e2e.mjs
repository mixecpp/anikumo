// Watch Together rooms, visitor counts, public-by-default profiles and the progress clock fix.
// Usage: npm run test:rooms   (dev server on http://localhost:8080; override with BASE_URL)
// Creates throwaway accounts and rooms and deletes them afterwards.
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

function client(xff = ip(), ua = `Mozilla/5.0 rooms-test ${randomUUID()}`) {
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
  const username = `rm${tag}_${stamp}`;
  const password = randomUUID();
  const u = await prisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 4), profilePublic: true, profileVisibility: "everyone", createdAt: new Date(Date.now() - 5 * DAY), ...data } });
  ids.push(u.id);
  const c = client();
  const login = await c("POST", "/api/auth/login", { username, password, captcha: CAPTCHA });
  assert.equal(login.status, 200, `login ${username}: ${login.text}`);
  return { ...u, c };
}

test("rooms and more", async (t) => {
  try {
    const host = await makeUser("hst");
    const friend = await makeUser("frd");
    const other = await makeUser("oth");
    const mod = await makeUser("mod", { isModerator: true });
    const admin = await makeUser("adm", { isAdmin: true });
    const room = (c, code, body) => c("POST", `/api/rooms/${code}`, body);
    let code;

    await t.test("starting a room needs an account, the human check and a clean name", async () => {
      assert.equal((await client()("POST", "/api/rooms", { name: "x", anilistId: 21, episode: 1, captcha: CAPTCHA })).status, 401);
      assert.equal((await host.c("POST", "/api/rooms", { name: "Movie night", anilistId: 21, episode: 1, isPublic: true })).status, 400, "no captcha token");
      assert.equal((await host.c("POST", "/api/rooms", { name: `${slur} club`, anilistId: 21, episode: 1, isPublic: true, captcha: CAPTCHA })).status, 400);
      assert.equal((await host.c("POST", "/api/rooms", { name: "ok", anilistId: 21, episode: 1, captcha: CAPTCHA })).status, 400, "too short");
      const r = await host.c("POST", "/api/rooms", { name: `One Piece night ${stamp}`, anilistId: 21, episode: 3, isPublic: true, captcha: CAPTCHA });
      assert.equal(r.status, 200, r.text);
      code = r.json.code;
      assert.match(code, /^[A-HJ-KM-NP-Z2-9]{6}$/);
      const lobby = await client()("GET", "/api/rooms");
      assert.ok(lobby.json.rooms.some((x) => x.code === code), "public room is listed");
      const page = await client()("GET", `/watch-together/${code}`);
      assert.equal(page.status, 200);
      assert.match(page.text, new RegExp(`One Piece night ${stamp}`));
    });

    await t.test("people join, chat, and the filters apply", async () => {
      assert.equal((await room(friend.c, code, { action: "join" })).status, 200);
      const poll = await friend.c("GET", `/api/rooms/${code}`);
      assert.equal(poll.json.room.episode, 3);
      assert.equal(poll.json.me.isHost, false);
      assert.ok(poll.json.members.some((m) => m.username === friend.username));
      assert.equal(poll.json.members.find((m) => m.username === host.username)?.role, "user");
      assert.equal((await room(friend.c, code, { action: "send", body: `hi all ${stamp}` })).status, 200);
      assert.equal((await room(friend.c, code, { action: "send", body: slur })).status, 400);
      assert.equal((await room(other.c, code, { action: "send", body: "not joined" })).status, 403, "must join to chat");
      const guest = await client()("GET", `/api/rooms/${code}`);
      assert.equal(guest.json.me, null);
      assert.ok(guest.json.messages.some((m) => m.body === `hi all ${stamp}`), "guests can read public rooms");
      assert.equal((await client()("POST", `/api/rooms/${code}`, { action: "send", body: "hi" })).status, 401);
    });

    await t.test("only the host controls the episode and the room", async () => {
      assert.equal((await room(friend.c, code, { action: "setEpisode", episode: 5 })).status, 403);
      assert.equal((await room(friend.c, code, { action: "state", position: 100, playing: true })).status, 403);
      assert.equal((await room(host.c, code, { action: "state", position: 321.5, playing: true })).status, 200);
      const p1 = await friend.c("GET", `/api/rooms/${code}`);
      assert.equal(p1.json.room.position, 321.5);
      assert.equal(p1.json.room.playing, true);
      assert.equal((await room(host.c, code, { action: "setEpisode", episode: 4 })).status, 200);
      const p2 = await friend.c("GET", `/api/rooms/${code}`);
      assert.equal(p2.json.room.episode, 4);
      assert.equal(p2.json.room.position, 0, "new episode starts from the top");
      assert.equal((await room(host.c, code, { action: "settings", chatOn: false })).status, 200);
      assert.equal((await room(friend.c, code, { action: "send", body: "chat off?" })).status, 403);
      assert.equal((await room(host.c, code, { action: "settings", chatOn: true, name: `${slur}s` })).status, 400, "rename is filtered");
      assert.equal((await room(host.c, code, { action: "settings", chatOn: true })).status, 200);
    });

    await t.test("hosts can remove people; reports reach moderators", async () => {
      assert.equal((await room(other.c, code, { action: "join" })).status, 200);
      assert.equal((await room(other.c, code, { action: "send", body: `spammy ${stamp}` })).status, 200);
      const msg = (await host.c("GET", `/api/rooms/${code}`)).json.messages.find((m) => m.body === `spammy ${stamp}`);
      assert.equal((await friend.c("POST", "/api/reports", { targetType: "room_message", targetId: msg.id, reason: "spam" })).status, 200);
      assert.equal((await room(friend.c, code, { action: "deleteMessage", id: msg.id })).status, 404, "members can't delete others' messages");
      assert.equal((await room(mod.c, code, { action: "deleteMessage", id: msg.id })).status, 200, "moderators can");
      const n = await prisma.notification.findFirst({ where: { userId: other.id, title: { contains: "Watch Together message" } } });
      assert.ok(n, "author told it was removed");
      assert.equal((await room(friend.c, code, { action: "kick", userId: other.id })).status, 403);
      assert.equal((await room(host.c, code, { action: "kick", userId: host.id })).status, 400);
      assert.equal((await room(host.c, code, { action: "kick", userId: other.id })).status, 200);
      assert.equal((await room(other.c, code, { action: "send", body: "back?" })).status, 403);
      assert.equal((await room(other.c, code, { action: "join" })).status, 403, "kicks stick");
    });

    await t.test("private rooms aren't listed; leaving hands the room over; ended rooms are gone", async () => {
      const r = await friend.c("POST", "/api/rooms", { name: `Secret ${stamp}`, anilistId: 21, episode: 1, isPublic: false, captcha: CAPTCHA });
      assert.equal(r.status, 200);
      assert.ok(!(await client()("GET", "/api/rooms")).json.rooms.some((x) => x.code === r.json.code));
      assert.equal((await friend.c("GET", `/api/rooms/${r.json.code}`)).status, 200, "the code still works");
      assert.equal((await room(friend.c, r.json.code, { action: "close" })).status, 200);
      assert.equal((await friend.c("GET", `/api/rooms/${r.json.code}`)).status, 404);

      assert.equal((await room(friend.c, code, { action: "join" })).status, 200);
      assert.equal((await room(host.c, code, { action: "leave" })).status, 200);
      const after = await friend.c("GET", `/api/rooms/${code}`);
      assert.equal(after.json.me.isHost, true, "the longest-staying person becomes host");
      assert.equal((await room(friend.c, code, { action: "leave" })).status, 200);
      assert.equal((await friend.c("GET", `/api/rooms/${code}`)).status, 404, "last one out ends it");
    });

    await t.test("visitor counts: unique per day, guests counted separately, shown to admins", async () => {
      const day = (await prisma.trafficDay.findMany({ orderBy: { day: "desc" }, take: 1 }))[0];
      const before = day ?? { views: 0, visitors: 0, guests: 0 };
      const visitor = client(ip(), `Mozilla/5.0 (iPhone) visitor ${stamp}`);
      for (const path of ["/", "/feed", "/feed?tab=everyone"]) assert.equal((await visitor("POST", "/api/hit", { path })).status, 204);
      assert.equal((await visitor("POST", "/api/hit", { path: "/api/secret" })).status, 204);
      const now = (await prisma.trafficDay.findMany({ orderBy: { day: "desc" }, take: 1 }))[0];
      assert.equal(now.views - (day?.day === now.day ? before.views : 0), 3, "three real page views (api paths ignored)");
      assert.equal(now.visitors - (day?.day === now.day ? before.visitors : 0), 1, "one visitor");
      assert.equal(now.guests - (day?.day === now.day ? before.guests : 0), 1, "a guest");
      const bot = client(ip(), "Googlebot/2.1");
      await bot("POST", "/api/hit", { path: "/" });
      assert.equal((await prisma.trafficDay.findUnique({ where: { day: now.day } })).views, now.views, "bots aren't counted");
      const metrics = await admin.c("GET", "/api/admin/metrics");
      assert.equal(metrics.status, 200);
      assert.ok(metrics.json.traffic.today.visitors >= 1);
      assert.ok(metrics.json.traffic.topPages.some((p) => p.path === "/feed"));
      assert.equal((await mod.c("GET", "/api/admin/metrics")).status, 403, "moderators don't see metrics");
    });

    await t.test("new accounts start with a public profile", async () => {
      const c = client();
      const username = `rmnew_${stamp}`;
      const r = await c("POST", "/api/auth/register", { username, password: randomUUID(), captcha: CAPTCHA });
      assert.equal(r.status, 200, r.text);
      const u = await prisma.user.findUnique({ where: { username } });
      ids.push(u.id);
      assert.equal(u.profileVisibility, "everyone");
      assert.equal(u.profilePublic, true);
    });

    await t.test("a device with a fast clock can still save progress", async () => {
      const ahead = Date.now() + 2 * 3600_000;
      const r = await friend.c("POST", "/api/progress", { anilistId: 21, episode: 9, progressSeconds: 100, durationSeconds: 1400, sampledAt: ahead, expectedUserId: friend.id });
      assert.equal(r.status, 200, r.text);
      const row = await prisma.watchProgress.findUnique({ where: { userId_anilistId_episode: { userId: friend.id, anilistId: 21, episode: 9 } } });
      assert.ok(row.sampledAt < BigInt(Date.now() + 60_000) || Number(row.sampledAt) < Date.now() + 60_000, "stored at server time, not two hours ahead");
      // and clearing history from that device can't block saves from the future
      assert.equal((await friend.c("DELETE", `/api/progress?anilistId=21&before=${ahead}`)).status, 200);
      const cut = await prisma.historyCutoff.findUnique({ where: { userId_anilistId: { userId: friend.id, anilistId: 21 } } });
      assert.ok(Number(cut.before) <= Date.now() + 1000);
    });
  } finally {
    await prisma.watchRoom.deleteMany({ where: { hostId: { in: ids } } });
    await prisma.report.deleteMany({ where: { reporterId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
