"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type HeroItem = {
  id: number;
  title: string;
  banner: string;
  cover: string;
  description: string;
  meta: string[];
  color: string | null;
};

export default function Hero({ items }: { items: HeroItem[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [items.length, i]);

  if (!items.length) return null;
  const cur = items[i];

  return (
    <section className="relative h-[62vh] min-h-[420px] w-full overflow-hidden">
      {items.map((it, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={it.id}
          src={it.banner}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${idx === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />

      <div key={cur.id} className="fade-in relative mx-auto flex h-full max-w-[1500px] items-end gap-8 px-4 pb-16 md:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.cover} alt="" className="hidden aspect-[2/3] w-44 rounded-xl object-cover shadow-2xl shadow-black/70 md:block" />
        <div className="max-w-2xl">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest" style={{ color: cur.color ?? "var(--accent)" }}>
            #{i + 1} Trending
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-5xl">{cur.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {cur.meta.map((m) => (
              <span key={m} className="chip !bg-white/10 !text-fg">
                {m}
              </span>
            ))}
          </div>
          <p className="mt-4 line-clamp-3 text-sm text-muted md:text-base">{cur.description}</p>
          <div className="mt-6 flex gap-3">
            <Link href={`/watch/${cur.id}/1`} className="btn btn-primary">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch now
            </Link>
            <Link href={`/anime/${cur.id}`} className="btn btn-ghost">
              Details
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-4 flex gap-1.5 md:right-8">
        {items.map((it, idx) => (
          <button
            key={it.id}
            onClick={() => setI(idx)}
            aria-label={`Show ${it.title}`}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-accent" : "w-3 bg-white/30 hover:bg-white/60"}`}
          />
        ))}
      </div>
    </section>
  );
}
