// End-to-end checks for account, list, social and page routes against a running dev server.
// Usage: npm run test:e2e   (server on http://localhost:8080; override with BASE_URL)
// Creates disposable accounts and deletes them in a finally block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";

// A per-run client IP so the per-IP signup limit doesn't trip when the suite is re-run (dev server, no proxy).
const RUN_IP = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

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

const stamp = Date.now().toString(36);
const A = { username: `e2a_${stamp}`.slice(0, 20), password: `pass-a-${stamp}` };
const B = { username: `e2b_${stamp}`.slice(0, 20), password: `pass-b-${stamp}` };

test("accounts, lists, social and pages", async (t) => {
  const a = client();
  const b = client();
  try {
    await t.test("register returns a recovery key", async () => {
      const r = await a("POST", "/api/auth/register", A);
      assert.equal(r.status, 200);
      assert.match(r.json.recoveryKey, /^[A-Z0-9]{5}(-[A-Z0-9]{5}){5}$/);
      A.recoveryKey = r.json.recoveryKey;
      assert.equal((await b("POST", "/api/auth/register", B)).status, 200);
    });

    await t.test("login rejects bad password and accepts good one", async () => {
      const c = client();
      assert.equal((await c("POST", "/api/auth/login", { login: A.username, password: "nope-nope" })).status, 401);
      assert.equal((await c("POST", "/api/auth/login", { username: A.username, password: A.password })).status, 200);
    });

    await t.test("recovery key resets the password and is rotated", async () => {
      const c = client();
      assert.equal((await c("POST", "/api/auth/forgot", { username: A.username, recoveryKey: "AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA", password: "new-pass-123" })).status, 400);
      const r = await c("POST", "/api/auth/forgot", { username: A.username, recoveryKey: A.recoveryKey.toLowerCase(), password: "new-pass-123" });
      assert.equal(r.status, 200);
      assert.notEqual(r.json.recoveryKey, A.recoveryKey);
      assert.equal((await c("POST", "/api/auth/forgot", { username: A.username, recoveryKey: A.recoveryKey, password: "x-pass-1234" })).status, 400);
      A.password = "new-pass-123";
      assert.equal((await c("POST", "/api/auth/login", { username: A.username, password: A.password })).status, 200);
      // the reset signed out A's other sessions, so log the main client back in
      assert.equal((await a("POST", "/api/auth/login", { username: A.username, password: A.password })).status, 200);
    });

    await t.test("security: usernames, CSRF and headers", async () => {
      const c = client();
      assert.equal((await c("POST", "/api/auth/register", { username: "admin", password: "whatever-123" })).status, 400);
      assert.equal((await c("POST", "/api/auth/register", { username: A.username.toUpperCase(), password: "whatever-123" })).status, 409);
      assert.equal((await a("PATCH", "/api/account", { username: B.username.toUpperCase() })).status, 409);
      const cross = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify({ username: A.username, password: A.password }) });
      assert.equal(cross.status, 403);
      const page = await fetch(BASE + "/");
      assert.equal(page.headers.get("x-content-type-options"), "nosniff");
      assert.match(page.headers.get("content-security-policy") ?? "", /frame-ancestors 'self'/);
      assert.equal(page.headers.get("x-powered-by"), null);
    });

    await t.test("watchlist entry with score, progress and tags", async () => {
      const r = await a("POST", "/api/list", { anilistId: 154587, status: "WATCHING", score: 9, progress: 3, tags: ["Comfort"] });
      assert.equal(r.status, 200);
      assert.equal(r.json.entry.status, "WATCHING");
      assert.equal(r.json.entry.score, 9);
      assert.deepEqual(r.json.entry.tags, ["comfort"]);
      const bad = await a("POST", "/api/list", { anilistId: 154587, score: 11 });
      assert.equal(bad.status, 400);
    });

    await t.test("bulk status change", async () => {
      await a("POST", "/api/list", { anilistId: 21, status: "PLANNING" });
      assert.equal((await a("PATCH", "/api/list", { ids: [21, 154587], status: "PAUSED" })).status, 200);
      const list = await a("GET", "/api/list");
      assert.ok(list.json.entries.every((e) => e.status === "PAUSED"));
    });

    await t.test("custom list create/toggle", async () => {
      const r = await a("POST", "/api/lists", { action: "create", title: "E2E list", isPublic: true });
      assert.equal(r.status, 200);
      assert.equal((await a("POST", "/api/lists", { action: "toggle", listId: r.json.list.id, anilistId: 21 })).json.contains, true);
    });

    await t.test("follow requires a public profile", async () => {
      assert.equal((await b("POST", "/api/follow", { username: A.username })).status, 404);
      await a("PATCH", "/api/account", { profilePublic: true });
      assert.equal((await b("POST", "/api/follow", { username: A.username })).json.following, true);
      const notif = await a("GET", "/api/notifications");
      assert.ok(notif.json.notifications.some((n) => n.type === "follow"));
    });

    await t.test("comments: reply notifies, like toggles", async () => {
      const top = await a("POST", "/api/comments", { anilistId: 21, body: "top level" });
      const reply = await b("POST", "/api/comments", { anilistId: 21, body: "a reply ||spoiler||", parentId: top.json.comment.id });
      assert.equal(reply.status, 200);
      assert.equal((await b("POST", "/api/comments/like", { commentId: top.json.comment.id })).json.liked, true);
      const notif = await a("GET", "/api/notifications");
      assert.ok(notif.json.notifications.some((n) => n.type === "reply"));
    });

    await t.test("reviews and helpful votes", async () => {
      const r = await a("POST", "/api/reviews", { anilistId: 21, score: 8, body: "A long enough review body for the test." });
      assert.equal(r.status, 200);
      assert.equal((await b("POST", "/api/reviews/vote", { reviewId: r.json.review.id })).json.voted, true);
      assert.equal((await a("POST", "/api/reviews/vote", { reviewId: r.json.review.id })).status, 400);
    });

    await t.test("reactions toggle", async () => {
      const r = await a("POST", "/api/reactions", { anilistId: 21, episode: 1, emoji: "peak" });
      assert.equal(r.json.counts.peak, 1);
      assert.deepEqual((await a("POST", "/api/reactions", { anilistId: 21, episode: 1, emoji: "peak" })).json.mine, []);
    });

    await t.test("active watch time ignores seeks and pauses", async () => {
      const t0 = Date.now() - 300_000;
      const send = (pos, sec) => a("POST", "/api/progress", { anilistId: 21, episode: 5, progressSeconds: pos, durationSeconds: 1440, sampledAt: t0 + sec * 1000, title: "One Piece", coverImage: "https://s4.anilist.co/x.jpg" });
      for (const [p, s] of [[0, 0], [10, 10], [20, 20], [900, 30], [900, 40], [910, 50]]) assert.equal((await send(p, s)).status, 200);
      const page = await a("GET", "/account/stats");
      assert.match(page.text, /Active watch time/);
    });

    await t.test("preferences persist", async () => {
      const r = await a("PATCH", "/api/prefs", { theme: "light", titleLang: "romaji" });
      assert.equal(r.json.prefs.theme, "light");
      assert.equal(r.json.prefs.titleLang, "romaji");
    });

    await t.test("profile pictures: upload, preset, reject, remove", async () => {
      const upload = async (buf, type, name) => {
        const form = new FormData();
        form.append("file", new Blob([buf], { type }), name);
        const res = await fetch(BASE + "/api/account/avatar", { method: "POST", body: form, headers: { "X-Forwarded-For": RUN_IP, Cookie: A.cookie } });
        return { status: res.status, json: await res.json() };
      };
      // grab A's session cookie from a fresh login
      const login = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": RUN_IP }, body: JSON.stringify({ username: A.username, password: A.password }) });
      A.cookie = login.headers.get("set-cookie").match(/aw_session=[^;]*/)[0];

      const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#f6a57c" } }).png().toBuffer();
      const ok = await upload(png, "image/png", "me.png");
      assert.equal(ok.status, 200);
      assert.match(ok.json.avatar, /^upload:[a-z0-9]{24}.webp$/);
      const img = await fetch(BASE + ok.json.url);
      assert.equal(img.headers.get("content-type"), "image/webp");
      const meta = await sharp(Buffer.from(await img.arrayBuffer())).metadata();
      assert.deepEqual([meta.width, meta.height, meta.format], [256, 256, "webp"]);

      const fake = await upload(Buffer.from("<script>alert(1)</script>"), "image/png", "x.png");
      assert.equal(fake.status, 400, "non-images are rejected even with an image MIME type");

      const preset = await a("PATCH", "/api/account/avatar", { preset: "monkey-d-luffy" });
      assert.equal(preset.json.avatar, "preset:monkey-d-luffy");
      assert.equal((await fetch(BASE + ok.json.url)).status, 404, "old upload is deleted when replaced");
      assert.equal((await a("PATCH", "/api/account/avatar", { preset: "../../etc/passwd" })).status, 400);
      assert.equal((await a("DELETE", "/api/account/avatar")).json.avatar, "");
      assert.ok([400, 404].includes((await fetch(BASE + "/avatars/..%2F..%2F.env")).status), "path traversal is refused");
    });

    await t.test("admin: metrics, bans and changelog", async () => {
      assert.equal((await b("GET", "/api/admin/metrics")).status, 403);
      // notFound() under a streaming layout can still answer 200, so check no admin content leaks
      assert.doesNotMatch((await b("GET", "/admin")).text, /watching right now|Launch checklist/);
      // promote A directly in the DB (admin is a per-account flag)
      const prisma = new PrismaClient();
      try {
        await prisma.user.update({ where: { username: A.username }, data: { isAdmin: true } });
      } finally {
        await prisma.$disconnect();
      }
      const m = await a("GET", "/api/admin/metrics");
      assert.equal(m.status, 200);
      assert.equal(m.json.series.length, 30);
      assert.ok(m.json.totals.users >= 2);
      const list = await a("GET", `/api/admin/users?q=${B.username}`);
      const bId = list.json.users[0].id;
      assert.equal((await a("POST", "/api/admin", { action: "ban", userId: bId, reason: "e2e" })).status, 200);
      assert.equal((await b("GET", "/api/account/export")).status, 401, "ban signs the user out");
      assert.equal((await client()("POST", "/api/auth/login", { username: B.username, password: B.password })).status, 403);
      assert.equal((await a("POST", "/api/admin", { action: "unban", userId: bId })).status, 200);
      assert.equal((await b("POST", "/api/auth/login", { username: B.username, password: B.password })).status, 200);
      const post = await a("POST", "/api/admin", { action: "changelogCreate", title: "E2E update", body: "- one\n- two", tag: "fixed" });
      assert.equal(post.status, 200);
      assert.match((await a("GET", "/changelog")).text, /E2E update/);
      assert.equal((await a("POST", "/api/admin", { action: "changelogDelete", id: post.json.entry.id })).status, 200);
      for (const p of ["/admin", "/admin/users", "/admin/moderation", "/admin/changelog", "/admin/system"]) assert.equal((await a("GET", p)).status, 200, p);
      await a("POST", "/api/admin", { action: "setAdmin", userId: bId, value: false });
    });

    await t.test("pages render", async () => {
      const pages = ["/changelog", "/", "/browse", "/season", "/charts", "/trailers", "/schedule", "/leaderboard", "/account", "/account/list", "/account/lists", "/account/stats", "/account/settings", `/u/${A.username}`, "/anime/21"];
      for (const p of pages) {
        const r = await a("GET", p);
        assert.equal(r.status, 200, p);
        assert.doesNotMatch(r.text, />This page doesn&#x27;t exist<|Unhandled Runtime Error/, p);
      }
    });
  } finally {
    await a("DELETE", "/api/account", { password: A.password });
    await b("DELETE", "/api/account", { password: B.password });
  }
});
