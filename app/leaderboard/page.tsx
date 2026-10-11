import Link from "next/link";
import type { Metadata } from "next";
import { Crown, Eye } from "lucide-react";
import { getLeaderboard, type LeaderPeriod } from "@/lib/leaderboard";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDuration } from "@/lib/watchtime";
import { Avatar } from "@/components/UserMenu";

export const metadata: Metadata = { title: "Leaderboard", description: "Who's watched the most anime — measured by real, active watch time." };
export const dynamic = "force-dynamic";

const PERIODS: [LeaderPeriod, string][] = [
  ["week", "This week"],
  ["month", "30 days"],
  ["all", "All time"],
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: LeaderPeriod = sp.period === "month" || sp.period === "all" ? sp.period : "week";
  const userId = await getUserId();
  const [rows, me] = await Promise.all([getLeaderboard(period, 100), userId ? prisma.user.findUnique({ where: { id: userId }, select: { username: true, profilePublic: true } }) : null]);
  const mine = userId ? rows.find((r) => r.userId === userId) : undefined;
  const top = rows[0]?.seconds ?? 1;

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Leaderboard</h1>
      <p className="mt-1.5 text-sm text-muted">Ranked by active watch time — only time while an episode is actually playing counts. Public profiles only.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-white/[0.04] p-1 text-sm">
          {PERIODS.map(([k, l]) => (
            <Link key={k} href={k === "week" ? "/leaderboard" : `/leaderboard?period=${k}`} className={`rounded-lg px-3 py-1.5 transition-colors ${period === k ? "bg-white/[0.09] text-fg" : "text-muted hover:text-fg"}`}>
              {l}
            </Link>
          ))}
        </div>
        {me && !me.profilePublic && (
          <Link href="/account/settings#profile" className="flex items-center gap-1.5 text-xs text-muted hover:text-fg">
            <Eye className="h-3.5 w-3.5" /> Make your profile public to appear here
          </Link>
        )}
        {mine && <span className="ml-auto font-mono text-xs text-accent">You&apos;re #{mine.rank}</span>}
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center text-sm text-muted">No one has watched anything in this period yet.</div>
      ) : (
        <ol className="mt-8 space-y-1.5">
          {rows.map((r) => {
            const isMe = r.userId === userId;
            return (
              <li key={r.userId}>
                <Link
                  href={`/u/${r.username}`}
                  className={`group relative flex items-center gap-4 overflow-hidden rounded-xl border px-4 py-3 transition-colors ${isMe ? "border-accent/40 bg-accent/[0.05]" : "border-white/[0.06] hover:border-white/15"}`}
                >
                  <span className="absolute inset-y-0 left-0 bg-white/[0.03]" style={{ width: `${(r.seconds / top) * 100}%` }} aria-hidden />
                  <span className={`relative w-7 text-right font-mono text-sm tabular-nums ${r.rank <= 3 ? "text-accent" : "text-muted"}`}>{r.rank === 1 ? <Crown className="ml-auto h-4 w-4" /> : r.rank}</span>
                  <span className="relative">
                    <Avatar name={r.username} color={r.avatarColor} size={32} />
                  </span>
                  <span className="relative min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">{r.username}</span>
                  <span className="relative hidden w-24 text-right font-mono text-xs text-muted sm:block">{r.episodes} eps</span>
                  <span className="relative hidden w-20 text-right font-mono text-xs text-muted sm:block">{r.shows} shows</span>
                  <span className="relative w-20 text-right font-mono text-sm tabular-nums">{formatDuration(r.seconds)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
