import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getCharacter, prettyEnum, stripHtml } from "@/lib/anilist";
import Synopsis from "@/components/Synopsis";
import AnimeCard from "@/components/AnimeCard";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCharacter(Number((await params).id)).catch(() => null);
  return { title: c?.name.full ?? "Character" };
}

export default async function CharacterPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const c = await getCharacter(id).catch(() => null);
  if (!c) notFound();
  const vas = new Map<number, { id: number; name: string; image: string }>();
  for (const e of c.media.edges) for (const v of e.voiceActors) vas.set(v.id, { id: v.id, name: v.name.full, image: v.image.large });
  const dob = c.dateOfBirth.month ? new Date(2000, c.dateOfBirth.month - 1, c.dateOfBirth.day ?? 1).toLocaleDateString(undefined, { month: "long", day: c.dateOfBirth.day ? "numeric" : undefined }) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 md:px-8">
      <div className="flex flex-col gap-8 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.image.large} alt={c.name.full} className="w-40 shrink-0 self-start rounded-xl object-cover ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <div className="label">Character</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{c.name.full}</h1>
          {c.name.native && <div className="mt-1 text-muted">{c.name.native}</div>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.gender && <span className="chip">{c.gender}</span>}
            {c.age && <span className="chip">Age {c.age}</span>}
            {dob && <span className="chip">Born {dob}</span>}
            {c.favourites ? (
              <span className="chip">
                <Heart className="h-3 w-3" /> {c.favourites.toLocaleString()}
              </span>
            ) : null}
          </div>
          <Synopsis text={stripHtml(c.description)} />
          {vas.size > 0 && (
            <div className="mt-6">
              <div className="label mb-2">Japanese voice</div>
              <div className="flex flex-wrap gap-2">
                {[...vas.values()].map((v) => (
                  <Link key={v.id} href={`/staff/${v.id}`} className="panel flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-sm transition-colors hover:border-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                    {v.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Appears in</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {c.media.edges.map((e) => (
            <div key={e.node.id}>
              <AnimeCard m={e.node} />
              <div className="mt-1 font-mono text-[10px] uppercase text-muted">{prettyEnum(e.characterRole)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
