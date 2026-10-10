import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMedia, prettyEnum, stripHtml, titleOf } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildEpisodes, getEpisodeProgress, getLibraryEpisodes } from "@/lib/episodes";
import EpisodeGrid from "@/components/EpisodeGrid";
import FavoriteButton from "@/components/FavoriteButton";
import Comments from "@/components/Comments";
import AnimeCard from "@/components/AnimeCard";
import Synopsis from "@/components/Synopsis";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await getMedia(Number((await params).id)).catch(() => null);
  return { title: m ? titleOf(m) : "Anime" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function AnimePage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [m, userId] = await Promise.all([getMedia(id), getUserId()]);
  if (!m) notFound();

  const [progress, libraryEps, fav] = await Promise.all([
    getEpisodeProgress(userId, id),
    getLibraryEpisodes(id),
    userId ? prisma.favorite.findUnique({ where: { userId_anilistId: { userId, anilistId: id } } }) : null,
  ]);

  const episodes = buildEpisodes(m, libraryEps);
  const title = titleOf(m);

  const watchedNums = Object.entries(progress).map(([n, p]) => ({ n: Number(n), ...p }));
  const lastInProgress = watchedNums.filter((p) => !p.completed).sort((a, b) => b.n - a.n)[0];
  const lastCompleted = watchedNums.filter((p) => p.completed).sort((a, b) => b.n - a.n)[0];
  const resumeEp = lastInProgress?.n ?? (lastCompleted ? Math.min(lastCompleted.n + 1, Math.max(episodes.length, 1)) : null);

  const streaming = m.externalLinks.filter((l) => l.type === "STREAMING");
  const relations = m.relations.edges.filter((e) => e.node.type === "ANIME");
  const recs = m.recommendations.nodes.map((n) => n.mediaRecommendation).filter((x) => x !== null);
  const start = m.startDate.year
    ? `${m.startDate.month ? MONTHS[m.startDate.month - 1] + " " : ""}${m.startDate.day ? m.startDate.day + ", " : ""}${m.startDate.year}`
    : null;

  const info: [string, string | null][] = [
    ["Format", prettyEnum(m.format)],
    ["Episodes", m.episodes ? String(m.episodes) : m.nextAiringEpisode ? `${m.nextAiringEpisode.episode - 1}+` : null],
    ["Duration", m.duration ? `${m.duration} min` : null],
    ["Status", prettyEnum(m.status)],
    ["Aired", start],
    ["Season", m.season ? `${prettyEnum(m.season)} ${m.seasonYear ?? ""}` : null],
    ["Studio", m.studios.nodes.map((s) => s.name).join(", ") || null],
    ["Source", prettyEnum(m.source)],
    ["Score", m.averageScore ? `${m.averageScore}%` : null],
    ["Popularity", m.popularity ? m.popularity.toLocaleString() : null],
  ];

  return (
    <div>
      <div className="relative h-[280px] w-full overflow-hidden md:h-[360px]">
        {m.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.bannerImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${m.coverImage.color ?? "#f43f5e"}55, transparent)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
      </div>

      <div className="relative mx-auto -mt-40 max-w-[1500px] px-4 md:px-8">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.coverImage.extraLarge}
            alt={title}
            className="mx-auto aspect-[2/3] w-48 shrink-0 rounded-2xl object-cover shadow-2xl shadow-black/70 md:mx-0 md:w-60"
          />
          <div className="flex-1 md:pt-24">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-4xl">{title}</h1>
            {m.title.romaji && m.title.romaji !== title && <div className="mt-1 text-muted">{m.title.romaji}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {m.genres.map((g) => (
                <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} className="chip transition hover:!border-accent hover:!text-fg">
                  {g}
                </Link>
              ))}
            </div>
            {m.nextAiringEpisode && (
              <div className="mt-3 text-sm text-accent-2">
                Episode {m.nextAiringEpisode.episode} airs{" "}
                {new Date(m.nextAiringEpisode.airingAt * 1000).toLocaleString(undefined, {
                  weekday: "long",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {episodes.length > 0 && (
                <Link href={`/watch/${id}/${resumeEp ?? 1}`} className="btn btn-primary">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {resumeEp ? `Continue · Ep ${resumeEp}` : "Watch Episode 1"}
                </Link>
              )}
              <FavoriteButton anilistId={id} title={title} coverImage={m.coverImage.large} initial={!!fav} loggedIn={!!userId} />
              {m.trailer?.site === "youtube" && (
                <a href={`https://www.youtube.com/watch?v=${m.trailer.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  ▶ Trailer
                </a>
              )}
            </div>
            <Synopsis text={stripHtml(m.description)} />
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-12">
            <section>
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold">
                Episodes <span className="text-base font-normal text-muted">{episodes.length}</span>
              </h2>
              <EpisodeGrid anilistId={id} episodes={episodes} progress={progress} libraryEpisodes={libraryEps} />
            </section>

            {m.characters.edges.length > 0 && (
              <section>
                <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold">Characters</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {m.characters.edges.map((c) => (
                    <div key={c.node.name.full} className="flex overflow-hidden rounded-xl border border-line bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.node.image.large} alt="" loading="lazy" className="h-20 w-14 object-cover" />
                      <div className="flex flex-1 items-center justify-between gap-2 px-3 text-xs">
                        <div>
                          <div className="font-medium text-fg">{c.node.name.full}</div>
                          <div className="text-muted">{prettyEnum(c.role)}</div>
                        </div>
                        {c.voiceActors[0] && (
                          <div className="text-right">
                            <div className="text-fg">{c.voiceActors[0].name.full}</div>
                            <div className="text-muted">Japanese</div>
                          </div>
                        )}
                      </div>
                      {c.voiceActors[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.voiceActors[0].image.large} alt="" loading="lazy" className="h-20 w-14 object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <Comments anilistId={id} loggedIn={!!userId} />
          </div>

          <aside className="space-y-8">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <dl className="space-y-3 text-sm">
                {info
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            {streaming.length > 0 && (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <h3 className="mb-3 text-sm font-semibold">Where to watch officially</h3>
                <div className="flex flex-col gap-2">
                  {streaming.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm transition hover:bg-white/10"
                    >
                      {l.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.icon} alt="" className="h-5 w-5 rounded p-0.5" style={{ background: l.color ?? "transparent" }} />
                      )}
                      {l.site}
                      <span className="ml-auto text-muted">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {relations.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold">Related</h3>
                <div className="space-y-2">
                  {relations.map((r) => (
                    <Link
                      key={r.node.id}
                      href={`/anime/${r.node.id}`}
                      className="flex gap-3 rounded-xl border border-line bg-surface p-2 transition hover:border-accent/60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.node.coverImage.large} alt="" loading="lazy" className="h-16 w-11 rounded object-cover" />
                      <div className="min-w-0 py-0.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-2">{prettyEnum(r.relationType)}</div>
                        <div className="line-clamp-2 text-sm">{titleOf(r.node)}</div>
                        <div className="text-xs text-muted">
                          {[prettyEnum(r.node.format), r.node.seasonYear].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {recs.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold">You might also like</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7">
              {recs.map((r) => (
                <AnimeCard key={r.id} m={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
