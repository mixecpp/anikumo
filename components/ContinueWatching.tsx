import Link from "next/link";

export type ContinueItem = {
  anilistId: number;
  episode: number;
  title: string;
  coverImage: string;
  progressSeconds: number;
  durationSeconds: number;
  completed: boolean;
};

export default function ContinueWatching({ items }: { items: ContinueItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between px-4 md:px-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold md:text-2xl">Continue watching</h2>
        <Link href="/profile" className="text-sm text-muted transition hover:text-accent">
          History →
        </Link>
      </div>
      <div className="scrollbar-none flex gap-4 overflow-x-auto px-4 pb-2 md:px-8">
        {items.map((it) => {
          const nextEp = it.completed ? it.episode + 1 : it.episode;
          const pct = it.completed ? 100 : it.durationSeconds ? (it.progressSeconds / it.durationSeconds) * 100 : 0;
          return (
            <Link
              key={it.anilistId}
              href={`/watch/${it.anilistId}/${nextEp}`}
              className="group flex w-[300px] shrink-0 gap-3 rounded-xl border border-line bg-surface p-2.5 transition hover:border-accent/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.coverImage} alt="" className="h-24 w-16 rounded-lg object-cover" />
              <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                <div>
                  <div className="line-clamp-2 text-sm font-medium group-hover:text-accent-2">{it.title}</div>
                  <div className="mt-1 text-xs text-muted">
                    {it.completed ? `Up next: Episode ${nextEp}` : `Episode ${it.episode} · ${fmt(it.progressSeconds)} in`}
                  </div>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
