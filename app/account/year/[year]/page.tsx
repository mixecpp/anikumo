import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageUserId } from "@/lib/auth";
import { yearInReview } from "@/lib/year";
import { formatDuration } from "@/lib/watchtime";

export const metadata: Metadata = { title: "Year in review" };

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  const now = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > now) notFound();
  const r = await yearInReview((await requirePageUserId("/account")), year);
  const peak = Math.max(1, ...r.months);
  const genreMax = Math.max(1, ...r.topGenres.map((g) => g.seconds));

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">{year} in review</h2>
        <div className="flex gap-1">
          <Link href={`/account/year/${year - 1}`} className="btn btn-ghost btn-icon" aria-label="Previous year">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {year < now && (
            <Link href={`/account/year/${year + 1}`} className="btn btn-ghost btn-icon" aria-label="Next year">
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {r.total < 60 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center text-sm text-muted">No watch time recorded in {year} yet. Your recap fills in as you watch.</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-5">
            {(
              [
                ["Watched", formatDuration(r.total)],
                ["Episodes", String(r.episodes)],
                ["Shows", String(r.shows)],
                ["Completed", String(r.completed)],
                ["Active days", String(r.activeDays)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="bg-bg p-5">
                <div className="text-2xl font-semibold tabular-nums tracking-tight">{v}</div>
                <div className="text-xs text-muted">{k}</div>
              </div>
            ))}
          </section>

          <section>
            <h3 className="label mb-4">By month</h3>
            <div className="flex h-40 items-end gap-2" role="img" aria-label="Watch time per month">
              {r.months.map((s, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t-md bg-accent/80 transition-all" style={{ height: `${Math.max(2, (s / peak) * 100)}%`, opacity: s ? 1 : 0.15 }} title={`${formatDuration(s)}`} />
                  <span className="font-mono text-[10px] text-muted">{MONTHS[i]}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            <section>
              <h3 className="label mb-4">Most watched</h3>
              <ol className="space-y-2">
                {r.topShows.map((s, i) => (
                  <li key={s.anilistId}>
                    <Link href={`/anime/${s.anilistId}`} className="panel flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:border-white/15">
                      <span className={`w-5 text-right font-mono text-sm ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {s.coverImage && <img src={s.coverImage} alt="" className="h-12 w-9 rounded object-cover" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
                      <span className="font-mono text-xs text-muted">{formatDuration(s.seconds)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h3 className="label mb-4">Top genres</h3>
              <ul className="space-y-2.5">
                {r.topGenres.map((g) => (
                  <li key={g.name} className="text-sm">
                    <div className="flex justify-between">
                      <span>{g.name}</span>
                      <span className="font-mono text-xs text-muted">{formatDuration(g.seconds)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(g.seconds / genreMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {r.binge && (
                <div className="panel mt-6 rounded-xl p-4">
                  <div className="label">Biggest binge</div>
                  <div className="mt-1 text-lg font-semibold">{formatDuration(r.binge.seconds)}</div>
                  <div className="text-xs text-muted">{new Date(r.binge.day + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
