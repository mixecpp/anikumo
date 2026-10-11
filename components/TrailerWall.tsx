"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { motion } from "motion/react";
import { Play } from "lucide-react";
import TrailerModal from "./TrailerModal";

type T = { anilistId: number; title: string; youtubeId: string; thumbnail: string; meta: string };

export default function TrailerWall({ items }: { items: T[] }) {
  const [open, setOpen] = useState<{ id: string; title: string } | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <>
      <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((t, i) => (
          <motion.div key={t.anilistId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(i, 16) * 0.02 }}>
            <button onClick={() => setOpen({ id: t.youtubeId, title: t.title })} className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]" aria-label={`Play ${t.title} trailer`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff]/90 text-[#0a0a0b] shadow-lg transition duration-300 group-hover:scale-110">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
              </span>
            </button>
            <Link href={`/anime/${t.anilistId}`} className="mt-2 block truncate text-sm hover:underline">
              {t.title}
            </Link>
            <div className="truncate font-mono text-[11px] text-muted">{t.meta}</div>
          </motion.div>
        ))}
      </div>
      <TrailerModal trailer={open} onClose={close} />
    </>
  );
}
