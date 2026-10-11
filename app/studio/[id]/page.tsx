import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd, pageMeta } from "@/lib/seo";
import { Heart } from "lucide-react";
import { getStudio } from "@/lib/anilist";

import { appUrl } from "@/lib/url";
import MediaGrid from "@/components/MediaGrid";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const s = await getStudio(id).catch(() => null);
  if (!s) return { title: "Studio" };
  const known = s.media.nodes.slice(0, 3).map((m) => m.title.english ?? m.title.romaji).filter(Boolean).join(", ");
  return pageMeta({
    title: `${s.name} anime`,
    description: `Every anime by ${s.name}${known ? `, including ${known}` : ""}. Ratings, seasons and where to watch.`,
    path: `/studio/${id}`,
  });
}

export default async function StudioPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const s = await getStudio(id).catch(() => null);
  if (!s) notFound();
  const upcoming = s.media.nodes.filter((m) => m.status === "NOT_YET_RELEASED" || m.status === "RELEASING");
  const past = s.media.nodes.filter((m) => m.status !== "NOT_YET_RELEASED" && m.status !== "RELEASING");
  const best = [...past].sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)).slice(0, 12);

  return (
    <div className="mx-auto max-w-[1400px] space-y-14 px-4 pt-10 md:px-8">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: s.name, url: appUrl(`/studio/${s.id}`) }} />
      <header>
        <div className="label">{s.isAnimationStudio ? "Animation studio" : "Studio"}</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{s.name}</h1>
        <p className="mt-1.5 flex items-center gap-3 font-mono text-[11px] text-muted">
          {s.media.nodes.length} titles
          {s.favourites ? (
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" /> {s.favourites.toLocaleString()}
            </span>
          ) : null}
        </p>
      </header>
      <MediaGrid title="Airing & upcoming" items={upcoming} />
      <MediaGrid title="Highest rated" items={best} />
      <MediaGrid title="All works" items={past} limit={48} />
    </div>
  );
}
