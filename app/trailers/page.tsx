import Link from "next/link";
import type { Metadata } from "next";
import { currentSeason, getSeason, shiftSeason } from "@/lib/anilist";
import { getUi } from "@/lib/server-i18n";
import ErrorNotice from "@/components/ErrorNotice";
import TrailerWall from "@/components/TrailerWall";

export const metadata: Metadata = { title: "Trailers", description: "Official trailers for this season and next." };

type SP = Record<string, string | undefined>;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function TrailersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = currentSeason();
  const next = shiftSeason(now.season, now.year, 1);
  const which = sp.next === "1" ? next : now;
  const { title } = await getUi();
  const media = await getSeason(which.season, which.year).catch((e: Error) => e);
  if (media instanceof Error) return <ErrorNotice message={media.message} />;

  const items = media
    .filter((m) => m.trailer?.site === "youtube" && m.trailer.id)
    .map((m) => ({
      anilistId: m.id,
      title: title(m.title),
      youtubeId: m.trailer!.id,
      thumbnail: m.trailer!.thumbnail ?? `https://i.ytimg.com/vi/${m.trailer!.id}/hqdefault.jpg`,
      meta: [m.studios.nodes[0]?.name, m.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · "),
    }));

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Trailers</h1>
          <p className="mt-1.5 text-sm text-muted">
            Official trailers · {label(which.season)} {which.year}
          </p>
        </div>
        <div className="flex rounded-xl bg-white/[0.04] p-1 text-sm">
          <Link href="/trailers" className={`rounded-lg px-3 py-1.5 transition-colors ${which === now ? "bg-white/[0.09] text-fg" : "text-muted hover:text-fg"}`}>
            This season
          </Link>
          <Link href="/trailers?next=1" className={`rounded-lg px-3 py-1.5 transition-colors ${which === next ? "bg-white/[0.09] text-fg" : "text-muted hover:text-fg"}`}>
            Next season
          </Link>
        </div>
      </div>
      <div className="mt-8">{items.length ? <TrailerWall items={items} /> : <p className="py-16 text-center text-sm text-muted">No trailers yet.</p>}</div>
    </div>
  );
}
