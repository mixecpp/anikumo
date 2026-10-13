import { prisma } from "./db";

/** Everything that can be reported, so reports and the moderation queue treat them all alike. */
export const REPORTABLE = ["comment", "review", "post", "post_comment", "profile_comment", "room_message"] as const;
export type ReportableType = (typeof REPORTABLE)[number];

export function isReportable(t: unknown): t is ReportableType {
  return typeof t === "string" && (REPORTABLE as readonly string[]).includes(t);
}

export type ReportedContent = { userId: string; author: string; body: string; href: string };

const AUTHOR = { select: { username: true } } as const;

/** Loads a piece of reported content for the moderation queue, or null if it's gone. */
export async function findContent(type: ReportableType, id: string): Promise<ReportedContent | null> {
  switch (type) {
    case "comment": {
      const c = await prisma.comment.findUnique({ where: { id }, include: { user: AUTHOR } });
      return c && { userId: c.userId, author: c.user.username, body: c.body, href: `${c.episode ? `/watch/${c.anilistId}/${c.episode}` : `/anime/${c.anilistId}`}#comment-${c.id}` };
    }
    case "review": {
      const r = await prisma.review.findUnique({ where: { id }, include: { user: AUTHOR } });
      return r && { userId: r.userId, author: r.user.username, body: [r.title, r.body].filter(Boolean).join("\n"), href: `/anime/${r.anilistId}` };
    }
    case "post": {
      const p = await prisma.post.findUnique({ where: { id }, include: { user: AUTHOR } });
      return p && { userId: p.userId, author: p.user.username, body: [p.body, p.animeTitle && `📺 ${p.animeTitle}`].filter(Boolean).join("\n"), href: `/post/${p.id}` };
    }
    case "post_comment": {
      const c = await prisma.postComment.findUnique({ where: { id }, include: { user: AUTHOR, post: { include: { user: AUTHOR } } } });
      return c && { userId: c.userId, author: c.user.username, body: c.body, href: `/post/${c.postId}` };
    }
    case "room_message": {
      const m = await prisma.watchRoomMessage.findUnique({ where: { id }, include: { user: AUTHOR, room: { select: { code: true } } } });
      return m && { userId: m.userId, author: m.user.username, body: m.body, href: `/watch-together/${m.room.code}` };
    }
    case "profile_comment": {
      const c = await prisma.profileComment.findUnique({ where: { id }, include: { user: AUTHOR, profile: AUTHOR } });
      return c && { userId: c.userId, author: c.user.username, body: c.body, href: `/u/${c.profile.username}#wall-${c.id}` };
    }
  }
}

/** Deletes reported content when a moderator upholds a report. */
export async function removeContent(type: ReportableType, id: string) {
  if (type === "comment") await prisma.comment.deleteMany({ where: { id } });
  else if (type === "review") await prisma.review.deleteMany({ where: { id } });
  else if (type === "post") await prisma.post.deleteMany({ where: { id } });
  else if (type === "post_comment") await prisma.postComment.deleteMany({ where: { id } });
  else if (type === "room_message") await prisma.watchRoomMessage.deleteMany({ where: { id } });
  else await prisma.profileComment.deleteMany({ where: { id } });
}

const LABEL: Record<ReportableType, string> = { comment: "comment", review: "review", post: "post", post_comment: "reply", profile_comment: "profile comment", room_message: "Watch Together message" };
const REASON: Record<string, string> = { spoiler: "an unmarked spoiler", harassment: "harassment", spam: "spam", offensive: "offensive content" };

/** Removes content as a moderator and tells the author what was removed and why. */
export async function removeAndNotify(type: ReportableType, id: string, reason = "") {
  const content = await findContent(type, id);
  await removeContent(type, id);
  if (!content) return null;
  const { notify } = await import("./notifications");
  const why = REASON[reason] ?? (reason && reason !== "other" ? reason : "");
  await notify(content.userId, {
    type: "system",
    title: `A moderator removed your ${LABEL[type]}${why ? ` for ${why}` : ""}`,
    body: `“${content.body.replace(/\|\|[\s\S]*?\|\|/g, "▒▒▒").slice(0, 140)}${content.body.length > 140 ? "…" : ""}” — please keep posts kind, on topic and spoiler-tagged.`,
    key: `removed:${type}:${id}`,
  });
  return content;
}
