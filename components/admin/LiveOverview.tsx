"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Clock, Flag, MessageSquare, UserPlus, Users } from "lucide-react";
import type { AdminMetrics } from "@/lib/admin";
import BarChart from "./BarChart";

const POLL_MS = 5000;

function hours(seconds: number) {
  const h = seconds / 3600;
  return h >= 10 ? `${Math.round(h)}h` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(seconds / 60)}m`;
}

function Pulse() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

function Num({ value }: { value: string | number }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={String(value)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="inline-block tabular-nums">
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

export default function LiveOverview({ initial }: { initial: AdminMetrics }) {
  const [m, setM] = useState(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch("/api/admin/metrics", { cache: "no-store" });
          if (!res.ok) throw new Error();
          if (alive) {
            setM(await res.json());
            setStale(false);
          }
        } catch {
          if (alive) setStale(true);
        }
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && (clearTimeout(timer), tick());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const tiles = [
    { label: "Signups today", value: m.today.signups, icon: UserPlus },
    { label: "Watch time today", value: hours(m.today.watchSeconds), icon: Clock },
    { label: "Viewers today", value: m.today.activeViewers, icon: Users },
    { label: "Comments today", value: m.today.comments, icon: MessageSquare },
    { label: "Open reports", value: m.totals.openReports, icon: Flag, href: "/admin/moderation", warn: m.totals.openReports > 0 },
    { label: "Errors (24h)", value: m.totals.errors24h, icon: AlertTriangle, href: "/admin/system", warn: m.totals.errors24h > 0 },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="panel flex flex-col justify-between rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Pulse /> Live {stale && <span className="text-amber-300">· reconnecting…</span>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-4xl font-semibold tracking-tight">
                <Num value={m.live.watchingNow} />
              </div>
              <div className="mt-1 text-xs text-muted">watching right now</div>
            </div>
            <div>
              <div className="text-4xl font-semibold tracking-tight text-fg/70">
                <Num value={m.live.onlineNow} />
              </div>
              <div className="mt-1 text-xs text-muted">online (10 min)</div>
            </div>
          </div>
          <div className="mt-4 font-mono text-[11px] text-muted" suppressHydrationWarning>
            {m.totals.users.toLocaleString()} users · updated {new Date(m.generatedAt).toLocaleTimeString()}
          </div>
        </div>

        <div className="panel rounded-xl p-5">
          <div className="text-sm font-medium">Being watched now</div>
          {m.live.shows.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Nobody is mid-episode right now.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              <AnimatePresence initial={false}>
                {m.live.shows.map((s) => (
                  <motion.li key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Link href={`/anime/${s.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                      {s.cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.cover} alt="" className="h-9 w-6 rounded object-cover" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
                      <span className="font-mono text-xs text-muted">
                        {s.viewers} {s.viewers === 1 ? "viewer" : "viewers"}
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => {
          const body = (
            <>
              <t.icon className={`h-4 w-4 ${t.warn ? "text-amber-300" : "text-muted"}`} />
              <div className="mt-3 text-2xl font-semibold tracking-tight">
                <Num value={t.value} />
              </div>
              <div className="mt-0.5 text-xs text-muted">{t.label}</div>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="bg-bg p-4 transition-colors hover:bg-panel">
              {body}
            </Link>
          ) : (
            <div key={t.label} className="bg-bg p-4">
              {body}
            </div>
          );
        })}
      </section>

      <section className="panel rounded-xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Visitors</h2>
          <span className="text-[11px] text-muted">Everyone, including people without an account · counts only, no tracking</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(
            [
              ["Visitors today", m.traffic.today.visitors],
              ["Guests today", m.traffic.today.guests],
              ["Page views", m.traffic.today.views],
              ["Guest page views", m.traffic.today.guestViews],
              ["On phones", `${m.traffic.today.mobileShare}%`],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <div className="text-xl font-semibold tabular-nums">{typeof v === "number" ? <Num value={v} /> : v}</div>
              <div className="text-xs text-muted">{k}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px]">
          <BarChart title="Unique visitors (14 days)" data={m.traffic.series.map((s) => ({ label: s.day, value: s.visitors }))} />
          <BarChart title="Guests without an account" data={m.traffic.series.map((s) => ({ label: s.day, value: s.guests }))} />
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted">Top pages today</h3>
            {m.traffic.topPages.length === 0 ? (
              <p className="text-xs text-muted">No visits yet today.</p>
            ) : (
              <ol className="space-y-1.5">
                {m.traffic.topPages.map((p) => (
                  <li key={p.path} className="flex items-center gap-2 text-xs">
                    <Link href={p.path} className="min-w-0 flex-1 truncate font-mono text-fg/80 hover:text-fg">{p.path}</Link>
                    <span className="font-mono tabular-nums text-muted">{p.views}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <BarChart title="Signups" data={m.series.map((s) => ({ label: s.day, value: s.signups }))} />
        <BarChart title="Watch hours" data={m.series.map((s) => ({ label: s.day, value: s.watchHours }))} format={(v) => (v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(v ? 1 : 0))} />
        <BarChart title="Daily viewers" data={m.series.map((s) => ({ label: s.day, value: s.activeViewers }))} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-xl p-5">
          <div className="text-sm font-medium">Most watched today</div>
          {m.today.topShows.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No viewing yet today.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {m.today.topShows.map((s, i) => {
                const pct = (s.seconds / m.today.topShows[0].seconds) * 100;
                return (
                  <li key={s.id} className="text-sm">
                    <div className="flex items-baseline gap-3">
                      <span className="w-4 font-mono text-xs text-muted">{i + 1}</span>
                      <Link href={`/anime/${s.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {s.title}
                      </Link>
                      <span className="font-mono text-xs text-muted">{hours(s.seconds)}</span>
                    </div>
                    <div className="ml-7 mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div className="h-full rounded-full bg-accent/70" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div className="panel rounded-xl p-5">
          <div className="text-sm font-medium">All time</div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {(
              [
                ["Users", m.totals.users],
                ["List entries", m.totals.listEntries],
                ["Comments", m.totals.comments],
                ["Reviews", m.totals.reviews],
                ["Custom lists", m.totals.customLists],
                ["Banned", m.totals.banned],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{v.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
