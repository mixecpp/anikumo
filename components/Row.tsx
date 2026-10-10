import Link from "next/link";
import type { MediaCard } from "@/lib/anilist";
import AnimeCard from "./AnimeCard";

export default function Row({
  title,
  items,
  href,
  ranked,
}: {
  title: string;
  items: MediaCard[];
  href?: string;
  ranked?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between px-4 md:px-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold md:text-2xl">{title}</h2>
        {href && (
          <Link href={href} className="text-sm text-muted transition hover:text-accent">
            View all →
          </Link>
        )}
      </div>
      <div className="scrollbar-none flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 md:scroll-px-8 md:px-8">
        {items.map((m, i) => (
          <div key={m.id} className="w-[140px] shrink-0 snap-start sm:w-[165px] lg:w-[180px]">
            <AnimeCard m={m} rank={ranked ? i + 1 : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}
