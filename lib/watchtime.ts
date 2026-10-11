import { prisma } from "./db";

/** Max wall-clock gap between samples that still counts as continuous viewing. */
const MAX_GAP_S = 120;
/** Most a single sample can credit (samples arrive roughly every 10s). */
const MAX_CREDIT_S = 60;
/** Playback may run up to this much faster than real time (speed controls) before it's treated as a seek. */
const MAX_SPEED = 2.5;
/** Daily cap per user, guarding the leaderboard against bad clients. */
const DAILY_CAP_S = 20 * 3600;

export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Credits active viewing time from consecutive playback samples. Time only counts when the
 * position moved forward roughly in step with the clock: pauses (no movement), seeks (jumps),
 * rewinds and long gaps (tab closed, came back later) earn nothing.
 */
export async function recordWatchTime(userId: string, s: { anilistId: number; episode: number; progressSeconds?: number; sampledAt: number }) {
  if (s.progressSeconds === undefined) return 0;
  const key = { userId_anilistId_episode: { userId, anilistId: s.anilistId, episode: s.episode } };
  const prev = await prisma.watchCursor.findUnique({ where: key });
  await prisma.watchCursor.upsert({
    where: key,
    create: { userId, anilistId: s.anilistId, episode: s.episode, position: s.progressSeconds, sampledAt: s.sampledAt },
    update: { position: s.progressSeconds, sampledAt: s.sampledAt },
  });
  if (!prev) return 0;

  const wall = (s.sampledAt - prev.sampledAt) / 1000;
  const moved = s.progressSeconds - prev.position;
  if (wall <= 0 || wall > MAX_GAP_S || moved <= 0 || moved > wall * MAX_SPEED + 3) return 0;
  const credit = Math.min(wall, MAX_CREDIT_S);

  const day = localDay(new Date(s.sampledAt));
  const today = await prisma.watchTime.aggregate({ where: { userId, day }, _sum: { seconds: true } });
  const room = DAILY_CAP_S - (today._sum.seconds ?? 0);
  if (room <= 0) return 0;
  const add = Math.min(credit, room);

  await prisma.watchTime.upsert({
    where: { userId_anilistId_episode_day: { userId, anilistId: s.anilistId, episode: s.episode, day } },
    create: { userId, anilistId: s.anilistId, episode: s.episode, day, seconds: add },
    update: { seconds: { increment: add } },
  });
  return add;
}

/** Fraction of an episode that must be actively watched for it to count as "watched" in stats. */
export const WATCHED_THRESHOLD = 0.5;

/**
 * Episodes genuinely watched: actively viewed for at least half their length.
 * Duration comes from the saved progress row (player-reported) or the show's listed length.
 */
export async function watchedEpisodes(userId: string, since?: Date) {
  const sinceDay = since ? localDay(since) : undefined;
  const times = await prisma.watchTime.groupBy({ by: ["anilistId", "episode"], where: { userId, ...(sinceDay ? { day: { gte: sinceDay } } : {}) }, _sum: { seconds: true } });
  const ids = [...new Set(times.map((t) => t.anilistId))];
  const [rows, snaps] = await Promise.all([
    prisma.watchProgress.findMany({ where: { userId, anilistId: { in: ids } }, select: { anilistId: true, episode: true, durationSeconds: true } }),
    prisma.mediaSnapshot.findMany({ where: { anilistId: { in: ids } }, select: { anilistId: true, duration: true } }),
  ]);
  const durations = new Map(rows.map((r) => [`${r.anilistId}:${r.episode}`, r.durationSeconds]));
  const listed = new Map(snaps.map((s) => [s.anilistId, (s.duration ?? 24) * 60]));
  return times.filter((t) => {
    const d = durations.get(`${t.anilistId}:${t.episode}`) || listed.get(t.anilistId) || 24 * 60;
    return (t._sum.seconds ?? 0) >= d * WATCHED_THRESHOLD;
  });
}

export async function totalSeconds(userId: string, since?: Date) {
  const agg = await prisma.watchTime.aggregate({ where: { userId, ...(since ? { day: { gte: localDay(since) } } : {}) }, _sum: { seconds: true } });
  return agg._sum.seconds ?? 0;
}

/** Seconds per local day for the last `days` days (oldest first). */
export async function dailySeconds(userId: string, days: number, anilistId?: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const rows = await prisma.watchTime.groupBy({
    by: ["day"],
    where: { userId, day: { gte: localDay(start) }, ...(anilistId ? { anilistId } : {}) },
    _sum: { seconds: true },
  });
  const byDay = new Map(rows.map((r) => [r.day, r._sum.seconds ?? 0]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDay(d);
    return { date: key, seconds: byDay.get(key) ?? 0 };
  });
}

/** Consecutive days (ending today or yesterday) with at least 5 minutes of viewing. */
export function streakFrom(daily: { seconds: number }[]) {
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].seconds >= 300) streak++;
    else if (i === daily.length - 1) continue;
    else break;
  }
  return streak;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 1) return seconds > 0 ? "<1m" : "0m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
