import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { getSnapshots } from "@/lib/media";
import { COMMENT_MAX, POST_MAX, getPost, listPosts } from "@/lib/posts";
import { requireStaff } from "@/lib/auth";
import { logAdmin } from "@/lib/admin";
import { checkWrite, writeStatus } from "@/lib/spam";
import { removeAndNotify } from "@/lib/reports";

const PERSON = { select: { username: true, avatarColor: true, avatar: true } } as const;

/**
 * GET ?username=&before=          that person's posts (if their privacy lets you see them)
 * GET ?feed=following|everyone    posts from people you follow (and you), or all public posts
 * GET ?id=                        one post with its comments
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const me = await requireUserId();
  const staff = me ? !!(await requireStaff()) : false;
  const id = sp.get("id");
  if (id) {
    const post = await getPost(id, me);
    if (!post) return fail("Post not found", 404);
    const comments = await prisma.postComment.findMany({ where: { postId: id }, orderBy: { createdAt: "asc" }, take: 200, include: { user: PERSON } });
    return NextResponse.json({
      post: post.view,
      staff,
      comments: comments.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt, author: c.user, mine: c.userId === me, canDelete: c.userId === me || post.row.userId === me || staff })),
    });
  }
  const before = sp.get("before") && !Number.isNaN(Date.parse(sp.get("before")!)) ? new Date(sp.get("before")!) : null;
  const feed = sp.get("feed");
  const result = await listPosts({ viewerId: me, before, scope: feed === "following" ? "following" : feed === "everyone" ? "everyone" : "user", username: sp.get("username") ?? undefined });
  if (!result) return fail("These posts are private", 404);
  return NextResponse.json({ ...result, staff }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * POST { action: "create", body, anilistId?, recommend? }
 *      { action: "delete", id }                         your own post
 *      { action: "like", id }                           toggles your like
 *      { action: "comment", id, body }
 *      { action: "deleteComment", id }                  yours, or any on your own post
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in first", 401);
  const b = await readJson<{ action: string; id: string; body: string; anilistId: number; recommend: boolean }>(req);
  const id = String(b.id ?? "");

  if (b.action === "create") {
    if (!rateLimit(`post:${userId}`, 10, 15 * 60_000).ok) return fail("That's a lot of posts — try again in a bit", 429);
    const body = String(b.body ?? "").trim();
    const anilistId = Number(b.anilistId) || null;
    if (!body && !anilistId) return fail("Write something or pick an anime");
    if (body.length > POST_MAX) return fail(`Posts are up to ${POST_MAX} characters`);
    const problem = await checkWrite(userId, "post", body);
    if (problem) return fail(problem, writeStatus(problem));
    let anime = { animeTitle: "", animeCover: "" };
    if (anilistId) {
      // Titles and covers come from AniList, not the client.
      const snap = (await getSnapshots([anilistId])).get(anilistId);
      if (!snap) return fail("Couldn't find that anime");
      anime = { animeTitle: snap.title, animeCover: snap.coverImage };
    }
    const post = await prisma.post.create({ data: { userId, body, anilistId, recommend: !!anilistId && b.recommend === true, ...anime } });
    const created = await getPost(post.id, userId);
    return NextResponse.json({ post: created?.view });
  }

  if (b.action === "comment") {
    if (!rateLimit(`postcomment:${userId}`, 20, 5 * 60_000).ok) return fail("Slow down a little", 429);
    const body = String(b.body ?? "").trim();
    if (!body || body.length > COMMENT_MAX) return fail(`Comments are 1–${COMMENT_MAX} characters`);
    const problem = await checkWrite(userId, "post_comment", body);
    if (problem) return fail(problem, writeStatus(problem));
    const post = await getPost(id, userId);
    if (!post) return fail("Post not found", 404);
    const comment = await prisma.postComment.create({ data: { postId: id, userId, body }, include: { user: PERSON } });
    if (post.row.userId !== userId) {
      await notify(post.row.userId, {
        type: "reply",
        title: `${comment.user.username} commented on your post`,
        body: body.slice(0, 140),
        href: `/u/${post.view.author.username}?tab=posts#post-${id}`,
        key: `postcomment:${comment.id}`,
      });
    }
    return NextResponse.json({ comment: { id: comment.id, body: comment.body, createdAt: comment.createdAt, author: comment.user, mine: true, canDelete: true } });
  }

  if (b.action === "like") {
    if (!rateLimit(`postlike:${userId}`, 120, 60_000).ok) return fail("Slow down a little", 429);
    if (!(await getPost(id, userId))) return fail("Post not found", 404);
    const key = { postId_userId: { postId: id, userId } };
    const had = await prisma.postLike.findUnique({ where: key });
    if (had) await prisma.postLike.delete({ where: key });
    else await prisma.postLike.create({ data: { postId: id, userId } });
    return NextResponse.json({ liked: !had, likes: await prisma.postLike.count({ where: { postId: id } }) });
  }

  if (b.action === "delete") {
    const { count } = await prisma.post.deleteMany({ where: { id, userId } });
    if (count) return NextResponse.json({ ok: true });
    const staff = await requireStaff();
    const post = staff ? await prisma.post.findUnique({ where: { id }, include: { user: { select: { username: true } } } }) : null;
    if (!staff || !post) return fail("Post not found", 404);
    await removeAndNotify("post", id);
    await logAdmin(staff.id, "Deleted post", post.user.username, post.body.slice(0, 200));
    return NextResponse.json({ ok: true });
  }

  if (b.action === "deleteComment") {
    const c = await prisma.postComment.findUnique({ where: { id }, include: { post: { select: { userId: true } }, user: { select: { username: true } } } });
    const own = !!c && (c.userId === userId || c.post.userId === userId);
    const staff = c && !own ? await requireStaff() : null;
    if (!c || (!own && !staff)) return fail("Comment not found", 404);
    if (staff) {
      await removeAndNotify("post_comment", id);
      await logAdmin(staff.id, "Deleted post comment", c.user.username, c.body.slice(0, 200));
    } else await prisma.postComment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return fail("Unknown action");
}
