import Link from "next/link";
import { Play } from "lucide-react";
import SectionHeading from "./SectionHeading";
import FadeRow from "./FadeRow";

export type ContinueItem = {
  anilistId: number;
  episode: number;
  title: string;
  coverImage: string;
  progressSeconds: number;
  durationSeconds: number;
  completed: boolean;
  nextEpisode?: number | null;
};

export default function ContinueWatching({ items }: { items: ContinueItem[] }) {
  if (!items.length) return null;
  return (
    <section>
      <SectionHeading title="Continue watching" href="/account/history" hrefLabel="History" />
      <FadeRow className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible sm:px-0 md:grid-cols-3">
        {items.slice(0, 6).map((it) => {
          const nextEp = it.completed ? it.nextEpisode ?? it.episode + 1 : it.episode;
          const pct = it.completed ? 0 : it.durationSeconds ? (it.progressSeconds / it.durationSeconds) * 100 : 0;
          return (
            <Link key={it.anilistId} href={`/watch/${it.anilistId}/${nextEp}`} className="group block w-[78%] min-w-0 shrink-0 snap-start sm:w-auto">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.coverImage} alt="" className="h-full w-full object-cover object-[center_25%] transition duration-500 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <span className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
                  <span className="grid h-11 w-11 scale-90 place-items-center rounded-full bg-white text-bg transition duration-300 group-hover:scale-100">
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  </span>
                </span>
                <span className="absolute bottom-2.5 left-3 font-mono text-[11px] text-fg/90">{it.completed ? `NEXT · EP ${nextEp}` : `EP ${it.episode}`}</span>
                {pct > 0 && (
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
                    <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                )}
              </div>
              <div className="mt-2 truncate text-sm text-fg/90">{it.title}</div>
            </Link>
          );
        })}
      </FadeRow>
    </section>
  );
}
