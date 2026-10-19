import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, roleOf } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { activeAnnouncement, chatSettings, deletedSince, latestAt, messagesSince, onlineCount, pinnedMessage, slowWait, touch } from "@/lib/chat";

/**
 * GET ?open=1&since=ISO: what every page polls for (components/live/LiveProvider).
 *  - always: how many people are online, the current announcement, chat on/off and the time of
 *    the newest message (for the unread dot)
 *  - with open=1: the chat itself; messages newer than `since` (the newest page without it),
 *    ids deleted since then, and the pinned message
 * Polling also marks you as online.
 */
export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`live:${ip}`, 600, 60_000).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const sp = new URL(req.url).searchParams;
  const open = sp.get("open") === "1";
  const sinceRaw = sp.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : null;

  const userId = await getUserId();
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, isAdmin: true, isModerator: true, mutedUntil: true, bannedAt: true } }) : null;
  touch(user ? `u:${user.id}` : `g:${createHash("sha256").update(`${ip}|${req.headers.get("user-agent") ?? ""}`).digest("base64url").slice(0, 16)}`, user?.id ?? null);

  const [settings, announcement, latest] = await Promise.all([chatSettings(), activeAnnouncement(), latestAt()]);
  const role = user ? roleOf(user) : null;
  const staff = !!role && role !== "user";
  const muted = !!user?.mutedUntil && user.mutedUntil > new Date();

  const chat: Record<string, unknown> = { on: settings.on, slowMode: settings.slowMode, latestAt: latest };
  if (open) {
    const [messages, pinned] = await Promise.all([messagesSince(since), pinnedMessage()]);
    Object.assign(chat, { messages, deleted: deletedSince(since), pinned });
  }

  return NextResponse.json(
    {
      now: Date.now(),
      online: onlineCount(),
      announcement,
      chat,
      me: user && !user.bannedAt
        ? { id: user.id, username: user.username, role, staff, muted, mutedUntil: muted ? user.mutedUntil!.toISOString() : null, slowWait: staff ? 0 : slowWait(user.id, settings.slowMode) }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
