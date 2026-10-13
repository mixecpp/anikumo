import { createHash } from "node:crypto";
import { prisma } from "./db";
import { localDay } from "./watchtime";

/**
 * Privacy-friendly traffic counts for the admin overview.
 *
 * Each page view from a real browser (sent by components/PageViews.tsx) adds to that day's
 * totals. Unique visitors are counted with a hash of a server secret, the day, the IP and the
 * browser name: it changes every day, can't be turned back into an IP, and the rows are
 * deleted after two days. Nothing here is tied to an account; "guest" just means not logged in.
 */
const secret = () => process.env.AUTH_SECRET || "anikumo-traffic";

/** Page paths worth counting: "/anime/21" stays, ids are kept, query strings are dropped. */
export function normalisePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.length > 200) return null;
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (!/^\/[\w\-./%]*$/.test(path) || path.startsWith("/api") || path.startsWith("/_next") || path.startsWith("/admin")) return null;
  return path;
}

export async function recordView(opts: { path: string; ip: string; userAgent: string; guest: boolean }) {
  const day = localDay();
  const mobile = /Mobi|Android|iPhone|iPad/i.test(opts.userAgent);
  const hash = createHash("sha256").update(`${secret()}|${day}|${opts.ip}|${opts.userAgent.slice(0, 200)}`).digest("base64url").slice(0, 22);

  const firstToday = await prisma.trafficVisitor
    .create({ data: { day, hash, guest: opts.guest } })
    .then(() => true)
    .catch(() => false); // already counted today
  const inc = (n: boolean) => ({ increment: n ? 1 : 0 });
  await prisma.$transaction([
    prisma.trafficDay.upsert({
      where: { day },
      create: { day, views: 1, guestViews: opts.guest ? 1 : 0, mobileViews: mobile ? 1 : 0, visitors: firstToday ? 1 : 0, guests: firstToday && opts.guest ? 1 : 0 },
      update: { views: { increment: 1 }, guestViews: inc(opts.guest), mobileViews: inc(mobile), visitors: inc(firstToday), guests: inc(firstToday && opts.guest) },
    }),
    prisma.trafficPage.upsert({ where: { day_path: { day, path: opts.path } }, create: { day, path: opts.path, views: 1 }, update: { views: { increment: 1 } } }),
  ]);
}

/** Drops visitor hashes older than yesterday and per-page rows older than 60 days. */
export async function pruneTraffic() {
  const keep = localDay(new Date(Date.now() - 86_400_000));
  const pages = localDay(new Date(Date.now() - 60 * 86_400_000));
  await prisma.trafficVisitor.deleteMany({ where: { day: { lt: keep } } }).catch(() => {});
  await prisma.trafficPage.deleteMany({ where: { day: { lt: pages } } }).catch(() => {});
}

export async function getTraffic(days: string[]) {
  const today = days[days.length - 1];
  const [rows, top] = await Promise.all([
    prisma.trafficDay.findMany({ where: { day: { gte: days[0] } } }),
    prisma.trafficPage.findMany({ where: { day: today }, orderBy: { views: "desc" }, take: 8 }),
  ]);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const t = byDay.get(today);
  return {
    today: { views: t?.views ?? 0, visitors: t?.visitors ?? 0, guests: t?.guests ?? 0, guestViews: t?.guestViews ?? 0, mobileShare: t?.views ? Math.round((t.mobileViews / t.views) * 100) : 0 },
    series: days.map((day) => ({ day, visitors: byDay.get(day)?.visitors ?? 0, guests: byDay.get(day)?.guests ?? 0, views: byDay.get(day)?.views ?? 0 })),
    topPages: top.map((p) => ({ path: p.path, views: p.views })),
  };
}
