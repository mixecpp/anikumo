import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { notify } from "@/lib/notifications";

const USER = { select: { id: true, username: true, avatarColor: true, profilePublic: true } } as const;

function shape<T extends { likes: { userId: string }[]; _count: { likes: number } }>(c: T, me: string | null) {
  const { likes, _count, ...rest } = c;
  return { ...rest, likeCount: _count.likes, liked: !!me && likes.some((l) => l.userId === me) };
}

/** GET ?anilistId&episode&sort=new|top → top-level comments with their replies. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const anilistId = toInt(sp.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  const episode = sp.get("episode") ? toInt(sp.get("episode")) : null;
  const sort = sp.get("sort") === "top" ? "top" : "new";
  const me = await requireUserId();

  const include = {
    user: USER,
    likes: { where: { userId: me ?? "" }, select: { userId: true } },
    _count: { select: { likes: true } },
  } as const;
  const rows = await prisma.comment.findMany({
    where: { anilistId, episode, parentId: null },
    orderBy: sort === "top" ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }] : { createdAt: "desc" },
    take: 100,
    include: { ...include, replies: { orderBy: { createdAt: "asc" }, take: 50, include } },
  });
  const comments = rows.map((c) => ({ ...shape(c, me), replies: c.replies.map((r) => shape(r, me)) }));
  return NextResponse.json({ comments, me });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to comment", 401);
  const b = await readJson<{ anilistId: number; episode: number | null; body: string; parentId: string | null }>(req);
  const anilistId = toInt(b.anilistId);
  const episode = b.episode == null ? null : toInt(b.episode);
  const body = String(b.body ?? "").trim();
  if (!anilistId) return fail("anilistId required");
  if (!body || body.length > 2000) return fail("Comment must be 1–2000 characters");

  let parent: { id: string; userId: string; parentId: string | null } | null = null;
  if (b.parentId) {
    parent = await prisma.comment.findUnique({ where: { id: String(b.parentId) }, select: { id: true, userId: true, parentId: true } });
    if (!parent) return fail("That comment no longer exists", 404);
    // Replies stay one level deep: replying to a reply attaches to its thread.
    if (parent.parentId) parent = await prisma.comment.findUnique({ where: { id: parent.parentId }, select: { id: true, userId: true, parentId: true } });
  }

  const recent = await prisma.comment.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (recent >= 5) return fail("Slow down — max 5 comments per minute", 429);

  const comment = await prisma.comment.create({
    data: { userId, anilistId, episode, body, parentId: parent?.id ?? null },
    include: { user: USER, likes: { select: { userId: true }, where: { userId } }, _count: { select: { likes: true } } },
  });

  if (parent && parent.userId !== userId) {
    const where = episode ? `/watch/${anilistId}/${episode}` : `/anime/${anilistId}`;
    await notify(parent.userId, {
      type: "reply",
      title: `${comment.user.username} replied to your comment`,
      body: body.replace(/\|\|[\s\S]*?\|\|/g, "▒▒▒").slice(0, 140),
      href: `${where}#comment-${parent.id}`,
      key: `reply:${comment.id}`,
    });
  }
  return NextResponse.json({ comment: { ...shape(comment, userId), replies: [] } });
}

/** PATCH { id, body } edits your own comment. */
export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const b = await readJson<{ id: string; body: string }>(req);
  const body = String(b.body ?? "").trim();
  if (!body || body.length > 2000) return fail("Comment must be 1–2000 characters");
  const { count } = await prisma.comment.updateMany({ where: { id: String(b.id ?? ""), userId }, data: { body, editedAt: new Date() } });
  if (!count) return fail("Not found", 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("id required");
  const { count } = await prisma.comment.deleteMany({ where: { id, userId } });
  if (!count) return fail("Not found", 404);
  return NextResponse.json({ ok: true });
}
