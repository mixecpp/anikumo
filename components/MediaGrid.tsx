import type { MediaCard } from "@/lib/anilist";
import AnimeCard from "./AnimeCard";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

export default function MediaGrid({
  title,
  items,
  href,
  limit = 12,
  ranked,
  narrow,
}: {
  title: string;
  items: MediaCard[];
  href?: string;
  limit?: number;
  ranked?: boolean;
  narrow?: boolean;
}) {
  if (!items.length) return null;
  return (
    <Reveal>
      <section>
        <SectionHeading title={title} href={href} />
        <div className={`grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 ${narrow ? "" : "lg:grid-cols-6"}`}>
          {items.slice(0, limit).map((m, i) => (
            <AnimeCard key={m.id} m={m} rank={ranked ? i + 1 : undefined} />
          ))}
        </div>
      </section>
    </Reveal>
  );
}
