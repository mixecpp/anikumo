import { prisma } from "./db";
import { getAiringInfo } from "./media";
import { appUrl } from "./url";
import { decrypt } from "./crypto";
import { watchedUpTo } from "./list";

type NotifyInput = { type: "episode" | "reply" | "follow" | "system"; title: string; body?: string; href?: string; image?: string; key?: string };

const DISCORD_WEBHOOK = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isDiscordWebhook(url: string) {
  return DISCORD_WEBHOOK.test(url);
}

/** Webhooks are stored encrypted; older rows may still be plain URLs. */
export function readWebhook(stored: string | null) {
  if (!stored) return null;
  if (stored.startsWith("https://")) return stored;
  try {
    return decrypt(stored);
  } catch {
    return null;
  }
}

/** Stores a notification (deduped by key) and pushes it to the user's opted-in channels. */
export async function notify(userId: string, n: NotifyInput) {
  try {
    await prisma.notification.create({
      data: { userId, type: n.type, title: n.title.slice(0, 200), body: (n.body ?? "").slice(0, 500), href: n.href ?? "", image: n.image ?? "", key: n.key ?? null },
    });
  } catch {
    return; // duplicate key — already delivered
  }
  deliver(userId, n).catch(() => {});
}

async function deliver(userId: string, n: NotifyInput) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordWebhook: true } });
  if (!user) return;
  const link = n.href ? appUrl(n.href) : appUrl("/notifications");
  const webhook = readWebhook(user.discordWebhook);
  if (webhook && isDiscordWebhook(webhook)) {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "AniKumo",
        embeds: [{ title: n.title, description: n.body || undefined, url: link, color: 0xf6a57c, thumbnail: n.image ? { url: n.image } : undefined }],
      }),
      signal: AbortSignal.timeout(8000),
    });
  }
}

const lastSweep = new Map<string, number>();

/**
 * Checks shows the user is watching for newly aired episodes. The first check per show only
 * records a baseline so a user isn't flooded with alerts for episodes that aired long ago.
 */
export async function syncEpisodeAlerts(userId: string) {
  if (Date.now() - (lastSweep.get(userId) ?? 0) < 10 * 60_000) return;
  lastSweep.set(userId, Date.now());

  const entries = await prisma.listEntry.findMany({ where: { userId, status: "WATCHING" }, take: 150 });
  if (!entries.length) return;
  const [airing, upTo] = await Promise.all([getAiringInfo(entries.map((e) => e.anilistId)), watchedUpTo(userId, entries.map((e) => e.anilistId))]);

  for (const e of entries) {
    const info = airing.get(e.anilistId);
    const latest = info?.latestAired;
    if (!latest || latest <= e.lastNotifiedEpisode) continue;
    const watched = Math.max(e.progress, upTo.get(e.anilistId) ?? 0);
    if (e.lastNotifiedEpisode > 0 && latest > watched) {
      await notify(userId, {
        type: "episode",
        title: `Episode ${latest} of ${e.title} is out`,
        body: watched < latest - 1 ? `You're ${latest - watched} episodes behind.` : "Pick up where you left off.",
        href: `/anime/${e.anilistId}`,
        image: e.coverImage,
        key: `ep:${e.anilistId}:${latest}`,
      });
    }
    await prisma.listEntry.update({ where: { id: e.id }, data: { lastNotifiedEpisode: latest } });
  }
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Shows on the user's list with aired episodes they haven't watched yet. */
export async function newEpisodeMap(userId: string, anilistIds: number[]) {
  if (!anilistIds.length) return new Map<number, number>();
  const [airing, upTo, entries] = await Promise.all([
    getAiringInfo(anilistIds).catch(() => new Map()),
    watchedUpTo(userId, anilistIds),
    prisma.listEntry.findMany({ where: { userId, anilistId: { in: anilistIds } }, select: { anilistId: true, progress: true } }),
  ]);
  const progress = new Map(entries.map((e) => [e.anilistId, e.progress]));
  const out = new Map<number, number>();
  for (const id of anilistIds) {
    const latest = airing.get(id)?.latestAired ?? 0;
    const watched = Math.max(progress.get(id) ?? 0, upTo.get(id) ?? 0);
    if (latest > watched && watched > 0) out.set(id, latest - watched);
  }
  return out;
}
