import { prisma } from "./db";
import { checkText } from "./automod";
import { rateLimit } from "./rate-limit";

/**
 * One gate for everything people write in public: episode/show comments, reviews, posts,
 * post comments and profile comments. Returns an error to show, or null when it's fine to post.
 *
 *  - banned or muted accounts can't post (muted people can still log in and watch)
 *  - slurs and harassment are blocked (lib/automod)
 *  - everyone: at most 8 posts a minute across all of these
 *  - accounts under a day old: one every 20 seconds and 40 a day; no links for 3 days
 *  - max 2 links, never invite links
 *  - no posting the exact same thing again within 10 minutes
 */
export type WriteKind = "comment" | "review" | "post" | "post_comment" | "profile_comment" | "room_message" | "chat_message";

const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;
const INVITE = /\b(?:discord\.gg|discord(?:app)?\.com\/invite|t\.me|chat\.whatsapp\.com)\b/i;
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const DAY = 24 * 3600_000;

export async function checkWrite(userId: string, kind: WriteKind, ...texts: string[]): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, bannedAt: true, mutedUntil: true, isAdmin: true, isModerator: true } });
  if (!user || user.bannedAt) return "Your account can't post right now";
  if (user.mutedUntil && user.mutedUntil > new Date()) {
    return `You've been muted by a moderator until ${user.mutedUntil.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  }

  const text = texts.filter(Boolean).join("\n");
  const blocked = checkText(text);
  if (blocked) return blocked;
  // Staff aren't rate limited, but still go through the language filter above.
  if (user.isAdmin || user.isModerator) return null;

  // Chats (live chat, Watch Together) are conversations, so they get their own, quicker allowance.
  const chat = kind === "room_message" || kind === "chat_message";
  if (chat ? !rateLimit(`chat:${userId}`, 20, 60_000).ok : !rateLimit(`write:${userId}`, 8, 60_000).ok) return "Slow down — you're posting very fast";
  const age = Date.now() - user.createdAt.getTime();
  if (age < DAY) {
    if (!rateLimit(`write-new:${chat ? "chat:" : ""}${userId}`, 1, chat ? 4_000 : 20_000).ok) return chat ? "New accounts can send a message every few seconds" : "New accounts can post once every 20 seconds for their first day";
    if (!rateLimit(`write-new-day:${userId}`, 40, DAY).ok) return "New accounts can post 40 times on their first day";
  }

  const links = text.match(LINK) ?? [];
  if (INVITE.test(text.toLowerCase().split("t.me/animekumo").join(""))) return "Invite links aren't allowed";
  if (links.length && age < 3 * DAY) return "New accounts can post links after 3 days";
  if (links.length > 2) return "Two links per post at most";

  const compact = squash(text);
  if (compact.length >= 3 && (await recentSame(userId, kind, compact))) return "You just posted that";
  return null;
}

async function recentSame(userId: string, kind: WriteKind, compact: string) {
  const since = new Date(Date.now() - 10 * 60_000);
  const select = { body: true } as const;
  const rows =
    kind === "comment"
      ? await prisma.comment.findMany({ where: { userId, createdAt: { gt: since } }, select, take: 5, orderBy: { createdAt: "desc" } })
      : kind === "review"
        ? []
        : kind === "post"
          ? await prisma.post.findMany({ where: { userId, createdAt: { gt: since } }, select, take: 5, orderBy: { createdAt: "desc" } })
          : kind === "post_comment"
            ? await prisma.postComment.findMany({ where: { userId, createdAt: { gt: since } }, select, take: 5, orderBy: { createdAt: "desc" } })
            : kind === "room_message"
              ? await prisma.watchRoomMessage.findMany({ where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } }, select, take: 3, orderBy: { createdAt: "desc" } })
              : kind === "chat_message"
                ? await prisma.chatMessage.findMany({ where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } }, select, take: 3, orderBy: { createdAt: "desc" } })
              : await prisma.profileComment.findMany({ where: { userId, createdAt: { gt: since } }, select, take: 5, orderBy: { createdAt: "desc" } });
  return rows.some((r) => squash(r.body) === compact);
}

/** Editing: same account and language rules, but no rate or duplicate checks. */
export async function checkEdit(userId: string, ...texts: string[]): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bannedAt: true, mutedUntil: true } });
  if (!user || user.bannedAt) return "Your account can't post right now";
  if (user.mutedUntil && user.mutedUntil > new Date()) return "You're muted right now";
  return checkText(texts.filter(Boolean).join("\n"));
}

/** 429 for "slow down" problems, 403 for muted/banned, 400 for everything else. */
export function writeStatus(message: string) {
  if (/slow down|once every|times on their first/i.test(message)) return 429;
  if (/muted|can't post/i.test(message)) return 403;
  return 400;
}
