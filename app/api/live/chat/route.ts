import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { logAdmin } from "@/lib/admin";
import { checkWrite, writeStatus } from "@/lib/spam";
import { getSnapshots } from "@/lib/media";
import { CHAT_MAX, SLOW_MODES, chatSettings, clearChat, createMessage, deleteMessage, messagesBefore, purgeUser, saveChatSettings, slowWait } from "@/lib/chat";

/** GET ?before=<id>: the page of older messages, for scrolling back. */
export async function GET(req: Request) {
  if (!rateLimit(`live-older:${clientIp(req.headers)}`, 40, 60_000).ok) return fail("Too many requests", 429);
  const before = new URL(req.url).searchParams.get("before") ?? "";
  if (!before) return fail("before is required");
  return NextResponse.json({ messages: await messagesBefore(before) }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * POST { action, ... }
 *   signed in: send {body, replyToId?, anime?: {id, episode}} | delete {id} (your own)
 *   staff:     delete {id} (anyone) | pin {id} | unpin | settings {on?, slowMode?} | purge {userId}
 *   admins:    clear
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to chat", 401);
  if (!rateLimit(`live-act:${userId}`, 60, 60_000).ok) return fail("Slow down a little", 429);
  const b = await readJson<Record<string, unknown>>(req);
  const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra });

  switch (b.action) {
    case "send": {
      const staff = await requireStaff();
      const settings = await chatSettings();
      if (!settings.on && !staff) return fail("The chat is paused right now", 403);
      const body = String(b.body ?? "").trim().replace(/\n{3,}/g, "\n\n");
      const share = b.anime && typeof b.anime === "object" ? (b.anime as Record<string, unknown>) : null;
      if (body.length > CHAT_MAX) return fail(`Messages are up to ${CHAT_MAX} characters`);
      if (!body && !share) return fail("Write a message first");
      const problem = await checkWrite(userId, "chat_message", body);
      if (problem) return fail(problem, writeStatus(problem));
      if (!staff) {
        const wait = slowWait(userId, settings.slowMode);
        if (wait) return fail(`Slow mode is on, you can send again in ${wait}s`, 429);
      }

      let replyToId: string | null = null;
      if (typeof b.replyToId === "string" && b.replyToId) {
        const parent = await prisma.chatMessage.findUnique({ where: { id: b.replyToId }, select: { id: true } });
        replyToId = parent?.id ?? null;
      }

      // The episode card title and cover come from AniList, never from what the browser sent.
      let anime = null;
      if (share) {
        const id = toInt(share.id);
        const episode = toInt(share.episode);
        if (!id || id < 1) return fail("Unknown anime");
        const snap = (await getSnapshots([id])).get(id);
        if (!snap || snap.isAdult) return fail("That anime cannot be shared here");
        anime = { id, episode: episode && episode > 0 && episode < 10000 ? episode : null, title: snap.title, cover: snap.coverImage };
      }

      const message = await createMessage({ userId, body, replyToId, anime });
      return ok({ message });
    }

    case "delete": {
      const msg = await prisma.chatMessage.findUnique({ where: { id: String(b.id ?? "") }, include: { user: { select: { username: true } } } });
      if (!msg) return ok();
      if (msg.userId !== userId) {
        const staff = await requireStaff();
        if (!staff) return fail("Message not found", 404);
        await logAdmin(staff.id, "Deleted live chat message", msg.user.username, msg.body.slice(0, 200));
      }
      await deleteMessage(msg.id);
      return ok();
    }

    case "pin":
    case "unpin": {
      const staff = await requireStaff();
      if (!staff) return fail("Only staff can pin messages", 403);
      await prisma.chatMessage.updateMany({ where: { pinned: true }, data: { pinned: false } });
      if (b.action === "pin") {
        const msg = await prisma.chatMessage.update({ where: { id: String(b.id ?? "") }, data: { pinned: true } }).catch(() => null);
        if (!msg) return fail("Message not found", 404);
        await logAdmin(staff.id, "Pinned a live chat message", "", msg.body.slice(0, 200));
      }
      return ok();
    }

    case "settings": {
      const staff = await requireStaff();
      if (!staff) return fail("Only staff can change the chat", 403);
      const patch: { on?: boolean; slowMode?: number } = {};
      if (typeof b.on === "boolean") patch.on = b.on;
      if (b.slowMode !== undefined) {
        const s = toInt(b.slowMode);
        if (s === null || !SLOW_MODES.includes(s)) return fail("Unknown slow mode");
        patch.slowMode = s;
      }
      const settings = await saveChatSettings(patch);
      await logAdmin(staff.id, "Changed live chat settings", "", JSON.stringify(settings));
      return ok({ settings });
    }

    case "purge": {
      const staff = await requireStaff();
      if (!staff) return fail("Only staff can do that", 403);
      const target = await prisma.user.findUnique({ where: { id: String(b.userId ?? "") }, select: { id: true, username: true } });
      if (!target) return fail("User not found", 404);
      const n = await purgeUser(target.id);
      await logAdmin(staff.id, "Removed all live chat messages", target.username, `${n} messages`);
      return ok({ removed: n });
    }

    case "clear": {
      const admin = await requireAdmin();
      if (!admin) return fail("Only admins can clear the chat", 403);
      await clearChat();
      await logAdmin(admin.id, "Cleared the live chat");
      return ok();
    }
  }
  return fail("Unknown action");
}
