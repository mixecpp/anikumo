import Link from "next/link";
import type { Unfinished } from "@/lib/home-personal";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

export default function FinishStarted({ items, title }: { items: Unfinished[]; title: string }) {
  if (!items.length) return null;
  return (
    <Reveal>
      <section>
        <SectionHeading title={title} href="/account/list" hrefLabel="My list" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Link key={it.anilistId} href={`/watch/${it.anilistId}/${it.progress + 1}`} className="panel group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:border-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.coverImage} alt="" loading="lazy" className="h-16 w-11 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm group-hover:underline">{it.title}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  {it.total - it.progress} episode{it.total - it.progress === 1 ? "" : "s"} left · paused {Math.floor((Date.now() - new Date(it.lastAt).getTime()) / 86_400_000)}d ago
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full bg-accent" style={{ width: `${it.pct * 100}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
