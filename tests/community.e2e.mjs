// Profile comments, staff badges, the feed and the automod across the site.
// Usage: npm run test:community   (dev server on http://localhost:8080; override with BASE_URL)
// Creates throwaway accounts in the database and deletes them afterwards.
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
  const username = `cm${tag}_${stamp}`;
  const password = randomUUID();
  const u = await prisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 4), profilePublic: true, profileVisibility: "everyone", createdAt: new Date(Date.now() - 5 * DAY), ...data } });
  ids.push(u.id);
  const c = client();
  const login = await c("POST", "/api/auth/login", { username, password, captcha: CAPTCHA });
  assert.equal(login.status, 200, `login ${username}: ${login.text}`);
  return { ...u, password, c };
}

test("community", async (t) => {
  try {
    const host = await makeUser("hst");
    const guest = await makeUser("gst");
    const other = await makeUser("oth");
    const mod = await makeUser("mod", { isModerator: true });
    const admin = await makeUser("adm", { isAdmin: true });
    const wall = (who, body) => who.c("POST", "/api/profile-comments", { action: "create", username: host.username, body });

    await t.test("anyone can comment on a public profile and the owner is notified", async () => {
      const r = await wall(guest, `Great taste ${stamp}`);
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.comment.author.username, guest.username);
      const n = await prisma.notification.findFirst({ where: { userId: host.id, title: { contains: "commented on your profile" } } });
      assert.ok(n, "owner notified");
      assert.match(n.href, new RegExp(`/u/${host.username}#wall-`));
      const list = await other.c("GET", `/api/profile-comments?username=${host.username}`);
      assert.equal(list.json.comments.length, 1);
      assert.equal(list.json.comments[0].canDelete, false, "strangers can't delete");
      assert.equal(list.json.canPost, true);
      // logged out: can read, can't write
      const anon = await client()("GET", `/api/profile-comments?username=${host.username}`);
      assert.equal(anon.json.comments.length, 1);
      assert.equal(anon.json.canPost, false);
      assert.equal((await client()("POST", "/api/profile-comments", { action: "create", username: host.username, body: "hi" })).status, 401);
    });

    await t.test("the profile owner can delete any comment; others only their own", async () => {
      const id = (await other.c("GET", `/api/profile-comments?username=${host.username}`)).json.comments[0].id;
      assert.equal((await other.c("POST", "/api/profile-comments", { action: "delete", id })).status, 404, "a stranger can't");
      const mine = await host.c("GET", `/api/profile-comments?username=${host.username}`);
      assert.equal(mine.json.comments[0].canDelete, true);
      assert.equal((await host.c("POST", "/api/profile-comments", { action: "delete", id })).status, 200);
      assert.equal(await prisma.profileComment.count({ where: { profileId: host.id } }), 0);
      // and authors can delete their own
      const own = await wall(other, `Hello from me ${stamp}`);
      assert.equal((await other.c("POST", "/api/profile-comments", { action: "delete", id: own.json.comment.id })).status, 200);
    });

    await t.test("owners choose who can comment: followers only, or nobody", async () => {
      assert.equal((await host.c("PATCH", "/api/account", { profileComments: "followers" })).status, 200);
      const blocked = await wall(other, `let me in ${stamp}`);
      assert.equal(blocked.status, 403);
      assert.match(blocked.json.error, /follow/);
      assert.equal((await other.c("POST", "/api/follow", { username: host.username })).status, 200);
      assert.equal((await wall(other, `following now ${stamp}`)).status, 200);

      assert.equal((await host.c("PATCH", "/api/account", { profileComments: "off" })).status, 200);
      const off = await other.c("GET", `/api/profile-comments?username=${host.username}`);
      assert.equal(off.json.off, true);
      assert.equal(off.json.comments.length, 0, "hidden while off");
      assert.equal((await wall(other, `still here? ${stamp}`)).status, 403);
      assert.equal((await host.c("PATCH", "/api/account", { profileComments: "nonsense" })).status, 400);
      assert.equal((await host.c("PATCH", "/api/account", { profileComments: "everyone" })).status, 200);
    });

    await t.test("private profiles can't be commented on; muted people can't comment", async () => {
      const shy = await makeUser("shy", { profileVisibility: "private", profilePublic: false });
      const r = await guest.c("POST", "/api/profile-comments", { action: "create", username: shy.username, body: "hi" });
      assert.equal(r.status, 404);
      assert.equal((await guest.c("GET", `/api/profile-comments?username=${shy.username}`)).status, 404);
      await prisma.user.update({ where: { id: guest.id }, data: { mutedUntil: new Date(Date.now() + 3600_000) } });
      const muted = await wall(guest, `muted ${stamp}`);
      assert.equal(muted.status, 403);
      await prisma.user.update({ where: { id: guest.id }, data: { mutedUntil: null } });
    });

    await t.test("profile comments can be reported and removed by moderators (author is told)", async () => {
      const c = (await wall(guest, `rude-ish ${stamp}`)).json.comment;
      assert.equal((await other.c("POST", "/api/reports", { targetType: "profile_comment", targetId: c.id, reason: "harassment" })).status, 200);
      const report = await prisma.report.findFirst({ where: { targetType: "profile_comment", targetId: c.id } });
      assert.ok(report);
      const queue = await mod.c("GET", "/admin/moderation");
      assert.match(queue.text, /Profile comment/);
      assert.equal((await mod.c("POST", "/api/admin", { action: "resolve", reportId: report.id })).status, 200);
      assert.equal(await prisma.profileComment.count({ where: { id: c.id } }), 0);
      const n = await prisma.notification.findFirst({ where: { userId: guest.id, title: { contains: "removed your profile comment" } } });
      assert.ok(n, "author notified");
      // and moderators can delete straight from the profile
      const c2 = (await wall(guest, `another ${stamp}`)).json.comment;
      assert.equal((await mod.c("POST", "/api/profile-comments", { action: "delete", id: c2.id })).status, 200);
    });

    await t.test("staff badges show next to names everywhere", async () => {
      const r = await wall(mod, `Welcome! ${stamp}`);
      assert.equal(r.json.comment.author.role, "moderator");
      const list = await guest.c("GET", `/api/profile-comments?username=${host.username}`);
      assert.equal(list.json.comments.find((c) => c.author.username === mod.username).author.role, "moderator");
      assert.equal(list.json.comments.find((c) => c.author.username === mod.username).author.isModerator, undefined, "raw flags aren't sent");

      const post = await admin.c("POST", "/api/posts", { action: "create", body: `Admin post ${stamp}` });
      assert.equal(post.json.post.author.role, "admin");
      const cm = await mod.c("POST", "/api/comments", { anilistId: 21, episode: 7, body: `mod comment ${stamp}` });
      assert.equal(cm.json.comment.user.role, "moderator");
      const thread = await guest.c("GET", "/api/comments?anilistId=21&episode=7");
      assert.equal(thread.json.comments.find((c) => c.id === cm.json.comment.id).user.role, "moderator");

      const page = await guest.c("GET", `/u/${mod.username}`);
      assert.match(page.text, />Moderator</);
      const adminPage = await guest.c("GET", `/u/${admin.username}`);
      assert.match(adminPage.text, />Admin</);
      const plain = await guest.c("GET", `/u/${guest.username}`);
      assert.doesNotMatch(plain.text, />(Moderator|Admin|Owner)</);
      const search = await guest.c("GET", `/api/search?q=@${mod.username}`);
      const hit = search.json.groups.flatMap((g) => g.items).find((i) => i.title === mod.username);
      assert.equal(hit?.role, "moderator");
    });

    await t.test("feed: recommendations filter, post pages and the home page strip", async () => {
      const rec = await host.c("POST", "/api/posts", { action: "create", body: `Watch this ${stamp}`, anilistId: 21, recommend: true });
      assert.equal(rec.status, 200, rec.text);
      const plainPost = await host.c("POST", "/api/posts", { action: "create", body: `Just chatting ${stamp}` });
      const recs = await guest.c("GET", "/api/posts?feed=everyone&recs=1");
      assert.ok(recs.json.posts.length > 0);
      assert.ok(recs.json.posts.every((p) => p.anime?.recommend), "only recommendations");
      assert.ok(recs.json.posts.some((p) => p.id === rec.json.post.id));
      assert.ok(!recs.json.posts.some((p) => p.id === plainPost.json.post.id));

      const page = await guest.c("GET", `/post/${rec.json.post.id}`);
      assert.equal(page.status, 200);
      assert.match(page.text, new RegExp(`Watch this ${stamp}`));
      assert.ok(isNotFound(await guest.c("GET", "/post/does-not-exist")));
      // a private author's post page is not visible to others
      await prisma.user.update({ where: { id: host.id }, data: { profileVisibility: "private", profilePublic: false } });
      assert.ok(isNotFound(await guest.c("GET", `/post/${rec.json.post.id}`)));
      assert.equal((await host.c("GET", `/post/${rec.json.post.id}`)).status, 200, "the author still can");
      await prisma.user.update({ where: { id: host.id }, data: { profileVisibility: "everyone", profilePublic: true } });

      const comment = await guest.c("POST", "/api/posts", { action: "comment", id: rec.json.post.id, body: `nice ${stamp}` });
      assert.equal(comment.status, 200);
      const n = await prisma.notification.findFirst({ where: { userId: host.id, key: `postcomment:${comment.json.comment.id}` } });
      assert.equal(n.href, `/post/${rec.json.post.id}#comments`);

      const home = await client()("GET", "/");
      assert.match(home.text, /Live on AniKumo/);
      const feed = await client()("GET", "/feed");
      assert.match(feed.text, /Most recommended/);
    });

    await t.test("automod covers profile comments, list names, notes and usernames", async () => {
      for (const body of [slur, "n1gg3r", `you ${["fa", "ggot"].join("")}`, "ni gger", "sieg heil", "kys"]) {
        const r = await wall(guest, body);
        assert.equal(r.status, 400, body);
      }
      assert.equal((await guest.c("POST", "/api/lists", { action: "create", title: `${slur} list` })).status, 400);
      const list = await guest.c("POST", "/api/lists", { action: "create", title: `Faves ${stamp}`, description: "good stuff" });
      assert.equal(list.status, 200);
      assert.equal((await guest.c("POST", "/api/lists", { action: "update", listId: list.json.list.id, description: `for ${slur}s` })).status, 400);
      assert.equal((await guest.c("POST", "/api/lists", { action: "toggle", listId: list.json.list.id, anilistId: 21 })).status, 200);
      assert.equal((await guest.c("POST", "/api/lists", { action: "note", listId: list.json.list.id, anilistId: 21, note: "kill yourself" })).status, 400);
      assert.equal((await guest.c("POST", "/api/lists", { action: "note", listId: list.json.list.id, anilistId: 21, note: "the best arc" })).status, 200);
      const rename = await guest.c("PATCH", "/api/account", { username: "n1gg3r_x" });
      assert.equal(rename.status, 400);
      assert.match(rename.json.error, /isn't allowed/);
      assert.equal((await guest.c("POST", "/api/posts", { action: "create", body: "1488" })).status, 400);
    });
  } finally {
    await prisma.post.deleteMany({ where: { userId: { in: ids } } });
    await prisma.comment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.report.deleteMany({ where: { reporterId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
