import Link from "next/link";
import type { Metadata } from "next";
import AnimeCard from "@/components/AnimeCard";
import ErrorNotice from "@/components/ErrorNotice";
import BrowseFilters from "@/components/BrowseFilters";
import { browse } from "@/lib/anilist";

export const metadata: Metadata = { title: "Browse" };

type SP = Record<string, string | undefined>;

function seasonNow() {
  const m = new Date().getMonth();
  return { season: m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL", year: new Date().getFullYear() };
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let season = sp.season;
  let year = sp.year ? Number(sp.year) : undefined;
  if (season === "current") {
    const now = seasonNow();
    season = now.season;
    year = now.year;
  }
  const page = Math.max(1, Number(sp.page) || 1);

  const data = await browse({
    q: sp.q,
    genre: sp.genre,
    year,
    season,
    format: sp.format,
    status: sp.status,
    sort: sp.sort,
    page,
  }).catch((e: Error) => e);

  if (data instanceof Error) return <ErrorNotice message={data.message} />;

  const pageHref = (p: number) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(p));
    return `/browse?${next}`;
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-8 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        {sp.q ? (
          <>
            Results for <span className="text-accent">&ldquo;{sp.q}&rdquo;</span>
          </>
        ) : (
          "Browse"
        )}
      </h1>
      <BrowseFilters current={{ ...sp, season, year: year ? String(year) : undefined }} />

      {data.Page.media.length === 0 ? (
        <p className="mt-16 text-center text-muted">Nothing matched those filters.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {data.Page.media.map((m) => (
            <AnimeCard key={m.id} m={m} />
          ))}
        </div>
      )}

      <div className="mt-12 flex items-center justify-center gap-3">
        {page > 1 && (
          <Link href={pageHref(page - 1)} className="btn btn-ghost">
            ← Previous
          </Link>
        )}
        <span className="text-sm text-muted">Page {page}</span>
        {data.Page.pageInfo.hasNextPage && (
          <Link href={pageHref(page + 1)} className="btn btn-ghost">
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
