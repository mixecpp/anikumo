import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { cached } from "./cache";
import { getMediaBatch, titleOf } from "./anilist";
import { localDay } from "./watchtime";
import { dbFile } from "./uploads";

/** Records an admin action for the audit log. Never throws. */
export async function logAdmin(adminId: string, action: string, target = "", detail = "") {
  await prisma.adminLog.create({ data: { adminId, action, target: target.slice(0, 200), detail: detail.slice(0, 500) } }).catch(() => {});
}

const DAYS = 30;

function dayKeys(n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(localDay(new Date(Date.now() - i * 86_400_000)));
  return out;
}

async function titlesFor(ids: number[]) {
  if (!ids.length) return new Map<number, { title: string; cover: string }>();
  const key = [...ids].sort((a, b) => a - b).join(",");
  const media = await cached(`admin:titles:${key}`, 6 * 3600, () => getMediaBatch(ids)).catch(() => []);
  return new Map(media.map((m) => [m.id, { title: titleOf(m), cover: m.coverImage.large }]));
}

export type AdminMetrics = Awaited<ReturnType<typeof getAdminMetrics>>;

/**
 * Everything the admin overview shows. "Watching now" comes from active watch-time samples
 * (only credited during real playback), "online" from session activity in the last 10 minutes.
 */
export async function getAdminMetrics() {
  const now = Date.now();
  const today = localDay();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const days = dayKeys(DAYS);
  const since = new Date(now - DAYS * 86_400_000);

  const [watchingRows, onlineRows, signupsToday, commentsToday, reviewsToday, todayWatch, users, signups, watchByDay, activeByDay, totals] = await Promise.all([
    prisma.watchTime.findMany({ where: { updatedAt: { gte: new Date(now - 90_000) } }, select: { userId: true, anilistId: true, episode: true } }),
    prisma.session.findMany({ where: { revokedAt: null, lastSeenAt: { gte: new Date(now - 10 * 60_000) } }, distinct: ["userId"], select: { userId: true } }),
    prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.comment.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.review.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.watchTime.groupBy({ by: ["anilistId"], where: { day: today }, _sum: { seconds: true }, orderBy: { _sum: { seconds: "desc" } } }),
    prisma.user.count(),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.watchTime.groupBy({ by: ["day"], where: { day: { gte: days[0] } }, _sum: { seconds: true } }),
    prisma.watchTime.groupBy({ by: ["day", "userId"], where: { day: { gte: days[0] } } }),
    Promise.all([
      prisma.listEntry.count(),
      prisma.comment.count(),
      prisma.review.count(),
      prisma.customList.count(),
      prisma.report.count({ where: { status: "open" } }),
      prisma.errorLog.count({ where: { createdAt: { gte: new Date(now - 86_400_000) } } }),
      prisma.user.count({ where: { bannedAt: { not: null } } }),
    ]),
  ]);

  const watchingUsers = new Set(watchingRows.map((r) => r.userId));
  const perShow = new Map<number, Set<string>>();
  for (const r of watchingRows) perShow.set(r.anilistId, (perShow.get(r.anilistId) ?? new Set()).add(r.userId));
  const topToday = todayWatch.slice(0, 6);
  const titles = await titlesFor([...new Set([...perShow.keys(), ...topToday.map((t) => t.anilistId)])]);
  const label = (id: number) => titles.get(id) ?? { title: `#${id}`, cover: "" };

  const signupCount = new Map<string, number>();
  for (const u of signups) signupCount.set(localDay(u.createdAt), (signupCount.get(localDay(u.createdAt)) ?? 0) + 1);
  const watchSeconds = new Map(watchByDay.map((w) => [w.day, w._sum.seconds ?? 0]));
  const activeCount = new Map<string, number>();
  for (const a of activeByDay) activeCount.set(a.day, (activeCount.get(a.day) ?? 0) + 1);

  const [listEntries, comments, reviews, customLists, openReports, errors24h, banned] = totals;
  return {
    generatedAt: new Date(now).toISOString(),
    live: {
      watchingNow: watchingUsers.size,
      onlineNow: new Set([...onlineRows.map((r) => r.userId), ...watchingUsers]).size,
      shows: [...perShow.entries()].map(([id, viewers]) => ({ id, viewers: viewers.size, ...label(id) })).sort((a, b) => b.viewers - a.viewers).slice(0, 8),
    },
    today: {
      signups: signupsToday,
      comments: commentsToday,
      reviews: reviewsToday,
      watchSeconds: watchSeconds.get(today) ?? 0,
      activeViewers: activeCount.get(today) ?? 0,
      topShows: topToday.map((t) => ({ id: t.anilistId, seconds: t._sum.seconds ?? 0, ...label(t.anilistId) })),
    },
    series: days.map((day) => ({ day, signups: signupCount.get(day) ?? 0, watchHours: (watchSeconds.get(day) ?? 0) / 3600, activeViewers: activeCount.get(day) ?? 0 })),
    totals: { users, listEntries, comments, reviews, customLists, openReports, errors24h, banned },
  };
}

/** Server health and configuration checks for the System tab. */
export function getSystemInfo() {
  const mem = process.memoryUsage();
  const file = dbFile();
  let dbBytes: number | null = null;
  try {
    if (file) dbBytes = fs.statSync(file).size;
  } catch {}
  let backups: { name: string; bytes: number; at: string }[] = [];
  try {
    const dir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
    backups = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".db") || f.endsWith(".sql"))
      .map((name) => {
        const st = fs.statSync(path.join(dir, name));
        return { name, bytes: st.size, at: st.mtime.toISOString() };
      })
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10);
  } catch {}

  const secret = process.env.AUTH_SECRET ?? "";
  const appUrl = process.env.APP_URL ?? "";
  const checks: { label: string; ok: boolean; hint: string }[] = [
    { label: "AUTH_SECRET is strong", ok: secret.length >= 32 && !secret.startsWith("replace-with"), hint: "Use a random value of 32+ characters (e.g. openssl rand -base64 48)." },
    { label: "APP_URL uses HTTPS", ok: appUrl.startsWith("https://"), hint: "Set APP_URL to your real domain, e.g. https://anikumo.com" },
    { label: "Running in production mode", ok: process.env.NODE_ENV === "production", hint: "Deploy with npm run build && npm start — dev mode is slower and skips HSTS/secure cookies." },
    { label: "Proxy IP header configured", ok: !!process.env.TRUSTED_IP_HEADER, hint: "Behind Cloudflare set TRUSTED_IP_HEADER=cf-connecting-ip (or x-real-ip for nginx) so rate limits see real IPs." },
    { label: "Recent database backup", ok: !!backups[0] && Date.now() - new Date(backups[0].at).getTime() < 7 * 86_400_000, hint: "Run npm run db:backup (ideally on a daily schedule)." },
  ];

  return {
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: { rss: Math.round(mem.rss / 1048576), heap: Math.round(mem.heapUsed / 1048576) },
    database: { provider: file ? "SQLite" : "PostgreSQL", bytes: dbBytes },
    backups,
    checks,
  };
}
