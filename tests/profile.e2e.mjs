// Profile privacy, banner and comment history against a running dev server.
// Usage: npm run test:profile   (server on http://localhost:8080; override with BASE_URL)
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const prisma = new PrismaClient();
const RUN_IP = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
const stamp = Date.now().toString(36).slice(-6);
const BANNER = "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg";

function client() {
  let cookie = "";
  return async (method, path, body) => {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", "X-Forwarded-For": RUN_IP, ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
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

// Pages stream, so a not-found page can still answer 200; Next marks it in the payload.
const isNotFound = (r) => r.status === 404 || r.text.includes("NEXT_HTTP_ERROR_FALLBACK;404");

const ids = [];
async function makeUser(tag) {
  const username = `pf${tag}_${stamp}`;
  const password = randomUUID();
  const u = await prisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 4) } });
  ids.push(u.id);
  const c = client();
  assert.equal((await c("POST", "/api/auth/login", { username, password })).status, 200);
  return { ...u, c };
}

test("profile privacy, banner and comment history", async (t) => {
  try {
    const A = await makeUser("a");
    const B = await makeUser("b");
    const anon = client();

    await t.test("new profiles are private", async () => {
      assert.ok(isNotFound(await anon("GET", `/u/${A.username}`)));
      assert.equal((await A.c("GET", `/u/${A.username}`)).status, 200, "owners always see their profile");
    });

    await t.test("banner must be an AniList anime banner", async () => {
      assert.equal((await A.c("PATCH", "/api/account", { profileBanner: "https://evil.example/x.jpg" })).status, 400);
      assert.equal((await A.c("PATCH", "/api/account", { profileBanner: BANNER })).status, 200);
      assert.match((await A.c("GET", `/u/${A.username}`)).text, /21-wf37VakJmZqs/);
    });

    await t.test("followers-only profiles", async () => {
      assert.equal((await A.c("PATCH", "/api/account", { profileVisibility: "followers" })).status, 200);
      const locked = await B.c("GET", `/u/${A.username}`);
      assert.equal(locked.status, 200);
      assert.match(locked.text, /followers can see this profile/);
      assert.doesNotMatch(locked.text, /Watch time/);
      assert.equal((await B.c("POST", "/api/follow", { username: A.username })).status, 200);
      assert.match((await B.c("GET", `/u/${A.username}`)).text, /Watch time/, "followers see it");
      assert.ok(!isNotFound(await anon("GET", `/u/${A.username}`)), "visitors get the locked page, not a 404");
      const u = await prisma.user.findUnique({ where: { id: A.id } });
      assert.equal(u.profilePublic, false, "followers-only isn't public for search, sitemap or leaderboard");
    });

    await t.test("sections can be hidden", async () => {
      assert.equal((await A.c("PATCH", "/api/account", { profileVisibility: "everyone", profileSections: { stats: false, comments: false } })).status, 200);
      const page = await anon("GET", `/u/${A.username}`);
      assert.equal(page.status, 200);
      assert.doesNotMatch(page.text, /Watch time/);
      assert.doesNotMatch(page.text, /tab=comments/);
      assert.match((await A.c("GET", `/u/${A.username}`)).text, /Watch time/, "the owner still sees everything");
      assert.doesNotMatch((await A.c("GET", `/u/${A.username}?preview=1`)).text, /Watch time/, "preview shows the visitor view");
    });

    await t.test("comment history tab", async () => {
      assert.equal((await A.c("PATCH", "/api/account", { profileSections: {} })).status, 200);
      assert.equal((await A.c("POST", "/api/comments", { anilistId: 21, episode: 1, body: `history check ${stamp}` })).status, 200);
      const tab = await anon("GET", `/u/${A.username}?tab=comments`);
      assert.match(tab.text, new RegExp(`history check ${stamp}`));
      assert.match(tab.text, /\/watch\/21\/1#comment-/);
      const peek = await anon("GET", "/api/comments?anilistId=21&episode=1&peek=1");
      assert.ok(peek.json.count >= 1);
      assert.ok(peek.json.top);
    });

    await t.test("follows, search and leaderboard opt-outs", async () => {
      assert.equal((await A.c("PATCH", "/api/account", { allowFollows: false, searchable: false })).status, 200);
      assert.equal((await B.c("POST", "/api/follow", { username: A.username })).status, 200, "unfollowing still works");
      assert.equal((await B.c("POST", "/api/follow", { username: A.username })).status, 403, "new follows are refused");
      const search = await anon("GET", `/api/search?q=${A.username}`);
      assert.ok(!JSON.stringify(search.json).includes(A.username), "hidden from member search");
      assert.equal((await A.c("PATCH", "/api/account", { profileVisibility: "nobody" })).status, 400);
      assert.equal((await A.c("PATCH", "/api/account", { profileVisibility: "private" })).status, 200);
      assert.ok(isNotFound(await anon("GET", `/u/${A.username}`)));
    });

    await t.test("pages render", async () => {
      for (const p of ["/account/settings", "/watch/21/1", "/", `/u/${A.username}`]) assert.equal((await A.c("GET", p)).status, 200, p);
      const banners = await anon("GET", "/api/banners?q=one%20piece");
      assert.equal(banners.status, 200);
      assert.ok(Array.isArray(banners.json.banners));
    });
  } finally {
    await prisma.comment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
