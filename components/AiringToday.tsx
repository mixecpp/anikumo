"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SectionHeading from "./SectionHeading";

export type AiringItem = { id: number; anilistId: number; airingAt: number; episode: number; title: string; cover: string };

function countdown(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function AiringToday({ items }: { items: AiringItem[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const upcoming = now === null ? items.slice(0, 7) : items.filter((it) => it.airingAt * 1000 > now - 2 * 3600_000).slice(0, 7);

  return (
    <section className="flex h-full flex-col">
      <SectionHeading title="Up next" href="/schedule" hrefLabel="Schedule" />
      <div className="panel flex-1 overflow-hidden rounded-2xl">
        {upcoming.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Nothing airing in the next 24 hours.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {upcoming.map((it) => {
              const aired = now !== null && it.airingAt * 1000 <= now;
              return (
                <li key={it.id}>
                  <Link
                    href={aired ? `/watch/${it.anilistId}/${it.episode}` : `/anime/${it.anilistId}`}
                    className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.cover} alt="" loading="lazy" className="h-11 w-8 shrink-0 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{it.title}</div>
                      <div className="font-mono text-[11px] text-muted">EP {it.episode}</div>
                    </div>
                    <span className={`shrink-0 font-mono text-[11px] tabular-nums ${aired ? "text-success" : "text-muted"}`}>
                      {now === null
                        ? new Date(it.airingAt * 1000).toISOString().slice(11, 16)
                        : aired
                          ? "Out now"
                          : it.airingAt * 1000 - now < 3 * 3600_000
                            ? `in ${countdown(it.airingAt * 1000 - now)}`
                            : new Date(it.airingAt * 1000).toLocaleString(undefined, {
                                weekday: new Date(it.airingAt * 1000).getDate() !== new Date(now).getDate() ? "short" : undefined,
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
