import { prisma } from "./db";
import { parseSections } from "./privacy-shared";

/**
 * Profile posts (Twitter-style). Who can see a post follows the author's profile privacy:
 * "everyone" → anyone, "followers" → people who follow them, "private" → only them, and the
 * "Posts" profile section switch hides them from everyone else.
 */

export const POST_MAX = 500;
export const COMMENT_MAX = 300;
export const PAGE = 20;

const AUTHOR = { select: { id: true, username: true, avatarColor: true, avatar: true, profileVisibility: true, profileSections: true, bannedAt: true } } as const;
type Author = { id: string; username: string; avatarColor: string; avatar: string; profileVisibility: string; profileSections: string; bannedAt: Date | null };

export type PostView = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  anime: { id: number; title: string; cover: string; recommend: boolean } | null;
  author: { username: string; avatarColor: string; avatar: string };
  likes: number;
  liked: boolean;
  comments: number;
  mine: boolean;
};

/** Can this viewer see posts by this author? `follows` = does the viewer follow them. */
export function canSeePosts(author: Author, viewerId: string | null, follows: boolean) {
  if (viewerId === author.id) return true;
  if (author.bannedAt || !parseSections(author.profileSections).posts) return false;
  if (author.profileVisibility === "everyone") return true;
  return author.profileVisibility === "followers" && follows;
}

async function followingSet(viewerId: string | null, authorIds: string[]) {
  if (!viewerId || !authorIds.length) return new Set<string>();
  const rows = await prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: authorIds } }, select: { followingId: true } });
  return new Set(rows.map((r) => r.followingId));
}

const include = (viewerId: string | null) =>
  ({
    user: AUTHOR,
    likes: { where: { userId: viewerId ?? "" }, select: { userId: true } },
    _count: { select: { likes: true, comments: true } },
  }) as const;

type Row = Awaited<ReturnType<typeof prisma.post.findMany<{ include: ReturnType<typeof include> }>>>[number];

function shape(p: Row, viewerId: string | null): PostView {
  return {
    id: p.id,
    body: p.body,
    createdAt: p.createdAt.toISOString(),
    editedAt: p.editedAt?.toISOString() ?? null,
    anime: p.anilistId ? { id: p.anilistId, title: p.animeTitle, cover: p.animeCover, recommend: p.recommend } : null,
    author: { username: p.user.username, avatarColor: p.user.avatarColor, avatar: p.user.avatar },
    likes: p._count.likes,
    liked: p.likes.length > 0,
    comments: p._count.comments,
    mine: p.userId === viewerId,
  };
}

/** A page of posts. `next` is the cursor for the following page (null at the end). */
export async function listPosts(opts: { viewerId: string | null; scope: "user" | "following" | "everyone"; username?: string; before?: Date | null }) {
  const { viewerId, scope } = opts;
  const cursor = opts.before ? { createdAt: { lt: opts.before } } : {};
  let where: Record<string, unknown>;

  if (scope === "user") {
    const author = await prisma.user.findUnique({ where: { username: opts.username ?? "" }, ...AUTHOR });
    if (!author) return null;
    const follows = (await followingSet(viewerId, [author.id])).has(author.id);
    if (!canSeePosts(author, viewerId, follows)) return null;
    where = { userId: author.id, ...cursor };
  } else if (scope === "following") {
    if (!viewerId) return { posts: [], next: null };
    const follows = await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    where = { userId: { in: [viewerId, ...follows.map((f) => f.followingId)] }, user: { profileVisibility: { not: "private" } }, ...cursor };
    // Your own posts show even when your profile is private.
    where = { OR: [where, { userId: viewerId, ...cursor }] };
  } else {
    where = { user: { profileVisibility: "everyone", bannedAt: null }, ...cursor };
  }

  const rows = await prisma.post.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, include: include(viewerId) });
  // Section switches and follower-only profiles are checked per author.
  const follows = scope === "user" ? null : await followingSet(viewerId, [...new Set(rows.map((r) => r.userId))]);
  const visible = scope === "user" ? rows : rows.filter((r) => canSeePosts(r.user, viewerId, follows!.has(r.userId)));
  return { posts: visible.map((r) => shape(r, viewerId)), next: rows.length === PAGE ? rows.at(-1)!.createdAt.toISOString() : null };
}

/** One post the viewer is allowed to see, or null. */
export async function getPost(id: string, viewerId: string | null) {
  const p = await prisma.post.findUnique({ where: { id }, include: include(viewerId) });
  if (!p) return null;
  const follows = (await followingSet(viewerId, [p.userId])).has(p.userId);
  return canSeePosts(p.user, viewerId, follows) ? { row: p, view: shape(p, viewerId) } : null;
}
