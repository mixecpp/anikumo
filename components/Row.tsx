"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaCard } from "@/lib/anilist";
import AnimeCard from "./AnimeCard";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

export default function Row({ title, items, href, ranked }: { title: string; icon?: string; items: MediaCard[]; href?: string; ranked?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  function update() {
    const el = scroller.current;
    if (el) setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }
  useEffect(update, [items]);

  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  if (!items.length) return null;

  return (
    <Reveal className="group/row mt-12">
      <div className="flex items-center justify-between px-4 md:px-8">
        <SectionHeading title={title} href={href} className="flex-1" />
        <div className="mb-4 ml-4 hidden gap-1 md:flex">
          {([-1, 1] as const).map((dir) => {
            const disabled = dir < 0 ? edges.start : edges.end;
            return (
              <button
                key={dir}
                onClick={() => scrollBy(dir)}
                disabled={disabled}
                aria-label={dir < 0 ? "Scroll left" : "Scroll right"}
                className="press grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-white/[0.08] hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
              >
                {dir < 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>
      <div ref={scroller} onScroll={update} className="scrollbar-none flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 md:gap-4 md:scroll-px-8 md:px-8">
        {items.map((m, i) => (
          <div key={m.id} className="w-[138px] shrink-0 snap-start sm:w-[160px] lg:w-[176px]">
            <AnimeCard m={m} rank={ranked ? i + 1 : undefined} />
          </div>
        ))}
      </div>
    </Reveal>
  );
}
