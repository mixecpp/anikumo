import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getStaff, prettyEnum, stripHtml } from "@/lib/anilist";
import { getUi } from "@/lib/server-i18n";
import Synopsis from "@/components/Synopsis";
import AnimeCard from "@/components/AnimeCard";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getStaff(Number((await params).id)).catch(() => null);
  return { title: s?.name.full ?? "Staff" };
}

export default async function StaffPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [s, { title }] = await Promise.all([getStaff(id).catch(() => null), getUi()]);
  if (!s) notFound();
  const roles = s.characterMedia.edges.flatMap((e) => e.characters.map((c) => ({ character: c, media: e.node, role: e.characterRole })));
  const seen = new Set<number>();
  const uniqueRoles = roles.filter((r) => (seen.has(r.character.id) ? false : (seen.add(r.character.id), true)));

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 md:px-8">
      <div className="flex flex-col gap-8 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.image.large} alt={s.name.full} className="w-40 shrink-0 self-start rounded-xl object-cover ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <div className="label">{s.primaryOccupations.join(" · ") || "Staff"}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{s.name.full}</h1>
          {s.name.native && <div className="mt-1 text-muted">{s.name.native}</div>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.languageV2 && <span className="chip">{s.languageV2}</span>}
            {s.homeTown && <span className="chip">{s.homeTown}</span>}
            {s.dateOfBirth.year && <span className="chip">Born {s.dateOfBirth.year}</span>}
            {s.favourites ? (
              <span className="chip">
                <Heart className="h-3 w-3" /> {s.favourites.toLocaleString()}
              </span>
            ) : null}
          </div>
          <Synopsis text={stripHtml(s.description)} />
        </div>
      </div>

      {uniqueRoles.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Voice roles</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {uniqueRoles.map((r) => (
              <div key={r.character.id} className="panel flex items-center gap-3 rounded-xl p-2">
                <Link href={`/character/${r.character.id}`} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.character.image.large} alt="" className="h-14 w-10 rounded object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/character/${r.character.id}`} className="block truncate text-sm hover:underline">
                    {r.character.name.full}
                  </Link>
                  <Link href={`/anime/${r.media.id}`} className="block truncate text-xs text-muted hover:text-fg">
                    {title(r.media.title)}
                  </Link>
                </div>
                <span className="font-mono text-[10px] uppercase text-muted">{prettyEnum(r.role)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {s.staffMedia.edges.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Staff work</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {s.staffMedia.edges.map((e) => (
              <div key={`${e.node.id}-${e.staffRole}`}>
                <AnimeCard m={e.node} />
                <div className="mt-1 truncate font-mono text-[10px] text-muted">{e.staffRole}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
