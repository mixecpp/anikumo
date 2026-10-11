"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, Play, Star } from "lucide-react";

export type HeroItem = {
  id: number;
  title: string;
  banner: string;
  cover: string;
  description: string;
  meta: string[];
  score: number | null;
  color: string | null;
};

const DURATION = 8000;

export default function Hero({ items }: { items: HeroItem[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % items.length), DURATION);
    return () => clearTimeout(t);
  }, [items.length, i, paused]);

  if (!items.length) return null;
  const cur = items[i];

  return (
    <section
      className="relative -mt-16 h-[72svh] min-h-[480px] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={cur.id}
          src={cur.banner}
          alt=""
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/75 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />

      <div className="relative mx-auto flex h-full max-w-[1400px] items-end px-4 pb-20 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={cur.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl"
          >
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">Trending · {i + 1}</div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{cur.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-fg/70">
              {cur.score && (
                <span className="flex items-center gap-1 text-fg">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {cur.score.toFixed(1)}
                </span>
              )}
              {cur.meta.map((m) => (
                <span key={m} className="flex items-center gap-2.5 before:h-1 before:w-1 before:rounded-full before:bg-white/30 first:before:hidden">
                  {m}
                </span>
              ))}
            </div>
            <p className="mt-4 line-clamp-2 max-w-lg text-[15px] leading-relaxed text-fg/60">{cur.description}</p>
            <div className="mt-7 flex gap-2.5">
              <Link href={`/watch/${cur.id}/1`} className="btn btn-primary !px-5 !py-2.5">
                <Play className="h-4 w-4 fill-current" />
                Play
              </Link>
              <Link href={`/anime/${cur.id}`} className="btn btn-ghost !px-5 !py-2.5 backdrop-blur-md">
                <Info className="h-4 w-4" />
                More info
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-8 left-1/2 flex w-full max-w-[1400px] -translate-x-1/2 gap-1.5 px-4 md:px-8">
        {items.map((it, idx) => (
          <button key={it.id} onClick={() => setI(idx)} aria-label={`Show ${it.title}`} className="group h-6 w-10 py-2.5">
            <span className="block h-[3px] overflow-hidden rounded-full bg-white/20 transition group-hover:bg-white/35">
              {idx === i && (
                <motion.span
                  key={`${it.id}-${paused}`}
                  className="block h-full bg-white"
                  initial={{ width: paused ? "100%" : "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: paused ? 0 : DURATION / 1000, ease: "linear" }}
                />
              )}
              {idx < i && <span className="block h-full w-full bg-white/60" />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
