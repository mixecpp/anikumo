"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { prettyEnum, type MediaCard } from "@/lib/anilist";
import { useTitle } from "./PrefsProvider";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

export default function RankedList({ title, items, href }: { title: string; items: MediaCard[]; href?: string }) {
  const titleOf = useTitle();
  if (!items.length) return null;
  return (
    <Reveal>
      <section>
        <SectionHeading title={title} href={href} />
        <ol className="panel divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
          {items.slice(0, 10).map((m, i) => (
            <li key={m.id}>
              <Link href={`/anime/${m.id}`} className="group flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
                <span className={`w-6 shrink-0 text-right font-mono text-sm tabular-nums ${i < 3 ? "text-accent" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.coverImage.large} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{titleOf(m.title)}</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                    {[prettyEnum(m.format), m.seasonYear, m.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {m.averageScore != null && (
                  <span className="flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-fg/80">
                    <Star className="h-3 w-3 fill-star text-star" />
                    {(m.averageScore / 10).toFixed(1)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </Reveal>
  );
}
