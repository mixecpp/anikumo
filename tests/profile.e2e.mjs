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

    await t.test("profile posts, recommendations, likes and comments", async () => {
      assert.equal((await A.c("PATCH", "/api/account", { profileVisibility: "everyone", profileSections: {}, allowFollows: true, searchable: true })).status, 200);
      assert.equal((await A.c("POST", "/api/posts", { action: "create", body: "" })).status, 400, "empty posts are refused");
      assert.equal((await A.c("POST", "/api/posts", { action: "create", body: "x".repeat(501) })).status, 400);
      const made = await A.c("POST", "/api/posts", { action: "create", body: `you have to watch this ${stamp}`, anilistId: 21, recommend: true });
      assert.equal(made.status, 200, made.text);
      const post = made.json.post;
      assert.equal(post.anime.id, 21);
      assert.equal(post.anime.recommend, true);
      assert.ok(post.anime.title.length > 0, "title comes from AniList, not the client");

      const everyone = await anon("GET", "/api/posts?feed=everyone");
      assert.ok(everyone.json.posts.some((p) => p.id === post.id), "public posts show in Everyone");
      assert.ok((await anon("GET", `/api/posts?username=${A.username}`)).json.posts.some((p) => p.id === post.id));

      // B follows A: A's post shows in B's Following feed; B likes and comments
      const followed = await B.c("POST", "/api/follow", { username: A.username });
      if (followed.json?.following === false) await B.c("POST", "/api/follow", { username: A.username });
      assert.ok((await B.c("GET", "/api/posts?feed=following")).json.posts.some((p) => p.id === post.id));
      const like = await B.c("POST", "/api/posts", { action: "like", id: post.id });
      assert.deepEqual([like.json.liked, like.json.likes], [true, 1]);
      const comment = await B.c("POST", "/api/posts", { action: "comment", id: post.id, body: "adding it to my list" });
      assert.equal(comment.status, 200);
      const note = await prisma.notification.findFirst({ where: { userId: A.id, title: { contains: "commented on your post" } } });
      assert.ok(note, "the author is notified");
      const thread = await anon("GET", `/api/posts?id=${post.id}`);
      assert.equal(thread.json.comments.length, 1);
      assert.equal(thread.json.post.comments, 1);
      assert.equal(thread.json.comments[0].canDelete, false);
      assert.equal((await anon("POST", "/api/posts", { action: "comment", id: post.id, body: "hi" })).status, 401);
      // the post owner can remove comments on their post; nobody else can delete the post
      assert.equal((await B.c("POST", "/api/posts", { action: "delete", id: post.id })).status, 404);
      assert.equal((await A.c("POST", "/api/posts", { action: "deleteComment", id: comment.json.comment.id })).status, 200);

      // privacy: followers-only hides posts from strangers; the Posts switch hides them from everyone else
      assert.equal((await A.c("PATCH", "/api/account", { profileVisibility: "followers" })).status, 200);
      assert.equal((await anon("GET", `/api/posts?username=${A.username}`)).status, 404);
      assert.ok(!(await anon("GET", "/api/posts?feed=everyone")).json.posts.some((p) => p.id === post.id));
      assert.equal((await B.c("GET", `/api/posts?username=${A.username}`)).status, 200, "followers still see them");
      assert.equal((await A.c("PATCH", "/api/account", { profileSections: { posts: false } })).status, 200);
      assert.equal((await B.c("GET", `/api/posts?username=${A.username}`)).status, 404);
      assert.equal((await A.c("GET", `/api/posts?username=${A.username}`)).status, 200, "you always see your own");
      assert.equal((await A.c("POST", "/api/posts", { action: "delete", id: post.id })).status, 200);
      assert.equal((await A.c("PATCH", "/api/account", { profileVisibility: "everyone", profileSections: {} })).status, 200);
      for (const p of ["/feed", "/feed?tab=everyone", `/u/${A.username}?tab=posts`]) assert.equal((await B.c("GET", p)).status, 200, p);
    });

    await t.test("member search", async () => {
      const r = await anon("GET", `/api/search?q=@${A.username.slice(0, 4)}`);
      assert.equal(r.json.groups[0]?.kind, "user");
      assert.ok(r.json.groups[0].items.some((i) => i.title === A.username));
    });

    await t.test("removing a show from history sticks", async () => {
      const t0 = Date.now();
      const save = (sampledAt, extra = {}) => B.c("POST", "/api/progress", { anilistId: 21, episode: 3, progressSeconds: 120, durationSeconds: 1400, sampledAt, title: "One Piece", coverImage: "", ...extra });
      assert.equal((await save(t0)).json.saved, true);
      assert.equal((await B.c("DELETE", `/api/progress?anilistId=21&before=${t0 + 50}`)).status, 200);
      // An old save still queued in the browser (or a late beacon) must not bring it back.
      const stale = await save(t0 + 10, { progressSeconds: 200 });
      assert.equal(stale.json.saved, false);
      assert.deepEqual((await B.c("GET", "/api/progress?anilistId=21")).json.progress, []);
      assert.doesNotMatch((await B.c("GET", "/account/history")).text, /One Piece/);
      // Watching it again afterwards works as normal.
      assert.equal((await save(t0 + 100)).json.saved, true);
      // Clear all history: same rule for every show.
      assert.equal((await B.c("DELETE", `/api/progress?all=1&before=${t0 + 200}`)).status, 200);
      assert.equal((await B.c("POST", "/api/progress", { anilistId: 1535, episode: 1, progressSeconds: 60, durationSeconds: 1400, sampledAt: t0 + 150, title: "Death Note", coverImage: "" })).json.saved, false);
      assert.equal((await save(t0 + 300)).json.saved, true);
    });

    await t.test("pages render", async () => {
      for (const p of ["/account/settings", "/watch/21/1", "/", `/u/${A.username}`]) assert.equal((await A.c("GET", p)).status, 200, p);
      const banners = await anon("GET", "/api/banners?q=one%20piece");
      assert.equal(banners.status, 200);
      assert.ok(Array.isArray(banners.json.banners));
    });
  } finally {
    await prisma.comment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.watchProgress.deleteMany({ where: { userId: { in: ids } } });
    await prisma.watchCursor.deleteMany({ where: { userId: { in: ids } } });
    await prisma.watchTime.deleteMany({ where: { userId: { in: ids } } });
    await prisma.historyCutoff.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
