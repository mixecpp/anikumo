import type { MediaCard } from "@/lib/anilist";
import AnimeCard from "./AnimeCard";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";
import FadeRow from "./FadeRow";

/** Extra cards shown in the phone swipe row beyond the desktop grid's limit. */
const PHONE_EXTRA = 6;

/**
 * A grid of anime cards. On phones it becomes a sideways swipe row (cards snap into place and
 * ~2½ are visible so it reads as scrollable); from sm up it's the normal grid.
 */
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
        <FadeRow
          className={`scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 sm:overflow-visible sm:px-0 md:grid-cols-4 ${narrow ? "" : "lg:grid-cols-6"}`}
        >
          {items.slice(0, limit + PHONE_EXTRA).map((m, i) => (
            <div key={m.id} className={`w-[42%] shrink-0 snap-start sm:w-auto ${i >= limit ? "sm:hidden" : ""}`}>
              <AnimeCard m={m} rank={ranked ? i + 1 : undefined} />
            </div>
          ))}
        </FadeRow>
      </section>
    </Reveal>
  );
}
