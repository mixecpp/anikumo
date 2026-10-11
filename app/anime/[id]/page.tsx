import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd, breadcrumbs, excerpt, isoDate, pageMeta } from "@/lib/seo";
import { ArrowUpRight, Play, Star } from "lucide-react";
import { getMedia, prettyEnum, stripHtml, titleOf } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildEpisodes, getEpisodeProgress, getLibraryEpisodes } from "@/lib/episodes";
import EpisodeGrid from "@/components/EpisodeGrid";
import FavoriteButton from "@/components/FavoriteButton";
import Comments from "@/components/Comments";
import Synopsis from "@/components/Synopsis";
import MediaGrid from "@/components/MediaGrid";
import SectionHeading from "@/components/SectionHeading";
import TrailerButton from "@/components/TrailerButton";
import SetAmbient from "@/components/SetAmbient";
import TrackRecent from "@/components/TrackRecent";
import ShareButton from "@/components/ShareButton";
import { getAniweebEpisodes } from "@/lib/playback/server";
import { similarByTags } from "@/lib/anilist";
import { getUi } from "@/lib/server-i18n";
import { getEntryDTO } from "@/lib/list";
import { friendsOnShow } from "@/lib/social";
import { getWatchOrder } from "@/lib/watch-order";
import { dailySeconds } from "@/lib/watchtime";
import { episodesPerDay, timeToFinish } from "@/lib/pace";
import EntryPanel from "@/components/list/EntryPanel";
import Reviews from "@/components/Reviews";
import ActivityGrid from "@/components/account/ActivityGrid";
import { Avatar } from "@/components/UserMenu";
import { STATUS_DOT, STATUS_LABEL, isStatus } from "@/lib/list-shared";

import { appUrl } from "@/lib/url";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const m = await getMedia(id).catch(() => null);
  if (!m) return { title: "Anime" };
  const name = titleOf(m);
  const kind = m.format === "MOVIE" ? "movie" : "anime";
  const facts = [prettyEnum(m.format), m.seasonYear, m.episodes ? `${m.episodes} episodes` : null, m.studios.nodes[0]?.name].filter(Boolean).join(" · ");
  const synopsis = excerpt(m.description, 150 - facts.length);
  return pageMeta({
    title: m.seasonYear ? `${name} (${m.seasonYear})` : name,
    description: `${facts}. ${synopsis || `Episodes, characters, reviews and where to watch ${name}.`}`.slice(0, 200),
    path: `/anime/${id}`,
    type: kind === "movie" ? "video.movie" : "video.tv_show",
    keywords: [name, m.title.romaji, m.title.english, ...m.genres, `${name} ${kind}`, `${name} episodes`].filter((k): k is string => !!k),
  });
}

/** schema.org TVSeries/Movie. Ratings only come from AniKumo's own reviews (never AniList's score). */
function animeJsonLd(m: NonNullable<Awaited<ReturnType<typeof getMedia>>>, rating: { avg: number | null; count: number }) {
  const name = titleOf(m);
  const movie = m.format === "MOVIE";
  const alternate = [...new Set([m.title.english, m.title.romaji, m.title.native, ...m.synonyms].filter((t): t is string => !!t && t !== name))].slice(0, 6);
  return {
    "@context": "https://schema.org",
    "@type": movie ? "Movie" : "TVSeries",
    name,
    alternateName: alternate.length ? alternate : undefined,
    url: appUrl(`/anime/${m.id}`),
    image: m.coverImage.extraLarge,
    description: excerpt(m.description, 500) || undefined,
    genre: m.genres,
    inLanguage: "ja",
    ...(movie ? { datePublished: isoDate(m.startDate), duration: m.duration ? `PT${m.duration}M` : undefined } : { startDate: isoDate(m.startDate), numberOfEpisodes: m.episodes ?? undefined }),
    productionCompany: m.studios.nodes.map((st) => ({ "@type": "Organization", name: st.name, url: appUrl(`/studio/${st.id}`) })),
    ...(rating.count > 0 && rating.avg
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Math.round(rating.avg * 10) / 10, bestRating: 10, worstRating: 1, ratingCount: rating.count } }
      : {}),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function AnimePage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [m, userId] = await Promise.all([getMedia(id), getUserId()]);
  if (!m) notFound();

  const topTags = m.tags.filter((t) => !t.isMediaSpoiler && t.rank >= 70).slice(0, 2).map((t) => t.name);
  const [progress, libraryEps, fav, remoteEpisodes, ui, entry, friends, order, similar, showDaily, pace] = await Promise.all([
    getEpisodeProgress(userId, id),
    getLibraryEpisodes(id),
    userId ? prisma.favorite.findUnique({ where: { userId_anilistId: { userId, anilistId: id } } }) : null,
    getAniweebEpisodes(id),
    getUi(),
    getEntryDTO(userId, id),
    friendsOnShow(userId, id),
    getWatchOrder(id).catch(() => null),
    similarByTags(id, topTags).catch(() => []),
    userId ? dailySeconds(userId, 7 * 12, id) : Promise.resolve(null),
    userId ? episodesPerDay(userId) : Promise.resolve(0),
  ]);
  const reviewStats = await prisma.review.aggregate({ where: { anilistId: id }, _avg: { score: true }, _count: true });

  const episodes = remoteEpisodes.length ? remoteEpisodes : buildEpisodes(m, libraryEps);
  const title = ui.title(m.title);
  const total = m.episodes ?? (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null);
  const finish = entry && total ? timeToFinish(total - entry.progress, m.duration, pace) : null;
  const relatedIds = new Set([id, ...m.relations.edges.map((e) => e.node.id), ...(order ?? []).map((o) => o.node.id)]);
  const similarShown = similar.filter((s) => !relatedIds.has(s.id) && !(ui.prefs.hideEcchi && s.genres.includes("Ecchi"))).slice(0, 12);
  const watchedShow = showDaily && showDaily.some((d) => d.seconds >= 60);

  const watchedNums = Object.entries(progress).map(([n, p]) => ({ n: Number(n), ...p }));
  const lastInProgress = watchedNums.filter((p) => !p.completed).sort((a, b) => b.n - a.n)[0];
  const lastCompleted = watchedNums.filter((p) => p.completed).sort((a, b) => b.n - a.n)[0];
  const resumeEp = lastInProgress?.n ?? (lastCompleted ? Math.min(lastCompleted.n + 1, Math.max(episodes.length, 1)) : null);
  const watchedCount = watchedNums.filter((p) => p.completed).length;

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
    ["Popularity", m.popularity ? m.popularity.toLocaleString() : null],
  ];
  const metaLine = [prettyEnum(m.format), m.seasonYear, m.episodes ? `${m.episodes} episodes` : null, prettyEnum(m.status)].filter(Boolean);
  const tags = m.tags.filter((t) => !t.isMediaSpoiler && t.rank >= 60).slice(0, 8);

  return (
    <div>
      <JsonLd
        data={[
          animeJsonLd(m, { avg: reviewStats._avg.score, count: reviewStats._count }),
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: m.format === "MOVIE" ? "Movies" : "Anime", path: m.format === "MOVIE" ? "/browse?format=MOVIE" : "/browse" },
            { name: titleOf(m), path: `/anime/${id}` },
          ]),
        ]}
      />
      <SetAmbient images={[m.bannerImage ?? m.coverImage.extraLarge]} />
      <TrackRecent id={id} title={title} cover={m.coverImage.large} />

      <div className="relative -mt-16 h-[44svh] min-h-[300px] w-full overflow-hidden">
        {m.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.bannerImage} alt="" className="h-full w-full object-cover opacity-80 [mask-image:linear-gradient(to_bottom,black_35%,transparent)]" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.coverImage.extraLarge} alt="" className="h-full w-full scale-110 object-cover opacity-40 blur-2xl [mask-image:linear-gradient(to_bottom,black_35%,transparent)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-bg/70 via-transparent to-transparent" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      <div className="relative mx-auto -mt-44 max-w-[1400px] px-4 md:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end md:gap-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.coverImage.extraLarge}
            alt={title}
            className="fade-in w-36 shrink-0 rounded-xl object-cover shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:w-48 md:w-56"
          />
          <div className="fade-in min-w-0 flex-1 pb-1" style={{ animationDelay: "60ms" }}>
            <div className="flex flex-wrap items-center gap-x-2.5 text-sm text-muted">
              {metaLine.map((x) => (
                <span key={String(x)} className="flex items-center gap-2.5 before:h-1 before:w-1 before:rounded-full before:bg-white/25 first:before:hidden">
                  {x}
                </span>
              ))}
            </div>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
            {m.title.romaji && m.title.romaji !== title && <div className="mt-1.5 text-muted">{m.title.romaji}</div>}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {m.averageScore != null && (
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-semibold tabular-nums">{(m.averageScore / 10).toFixed(1)}</span>
                  <span className="text-muted">/ 10</span>
                </span>
              )}
              {m.nextAiringEpisode && (
                <span className="flex items-center gap-2 text-fg/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Ep {m.nextAiringEpisode.episode}{" "}
                  {new Date(m.nextAiringEpisode.airingAt * 1000).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              {watchedCount > 0 && (
                <span className="text-muted">
                  {watchedCount}/{episodes.length || "?"} watched
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {episodes.length > 0 && (
                <Link href={`/watch/${id}/${resumeEp ?? episodes[0]?.number ?? 1}`} className="btn btn-primary !px-5">
                  <Play className="h-4 w-4 fill-current" />
                  {resumeEp ? `Continue episode ${resumeEp}` : "Play"}
                </Link>
              )}
              <FavoriteButton anilistId={id} title={title} coverImage={m.coverImage.large} initial={!!fav} loggedIn={!!userId} />
              {m.trailer?.site === "youtube" && <TrailerButton youtubeId={m.trailer.id} title={title} />}
              <ShareButton title={title} />
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-14">
            <section>
              <Synopsis text={stripHtml(m.description)} />
              <div className="mt-5 flex flex-wrap gap-1.5">
                {m.genres.map((g) => (
                  <Link key={g} href={`/browse?genre=${encodeURIComponent(g)}`} className="chip">
                    {g}
                  </Link>
                ))}
                {tags.map((t) => (
                  <span key={t.name} className="chip !bg-transparent ring-1 ring-inset ring-white/[0.08]">
                    {t.name}
                  </span>
                ))}
              </div>
            </section>

            <section id="episodes" className="scroll-mt-24">
              <SectionHeading title="Episodes" count={episodes.length} />
              <EpisodeGrid anilistId={id} episodes={episodes} progress={progress} libraryEpisodes={libraryEps} />
            </section>

            {m.characters.edges.length > 0 && (
              <section>
                <SectionHeading title="Characters" />
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  {m.characters.edges.map((c) => (
                    <div key={c.node.id} className="flex items-center gap-3 border-b border-white/[0.05] py-2.5">
                      <Link href={`/character/${c.node.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.node.image.large} alt="" loading="lazy" className="h-11 w-11 rounded-full object-cover" />
                        <div className="min-w-0">
                          <div className="truncate text-sm group-hover:underline">{c.node.name.full}</div>
                          <div className="text-xs text-muted">{prettyEnum(c.role)}</div>
                        </div>
                      </Link>
                      {c.voiceActors[0] && (
                        <Link href={`/staff/${c.voiceActors[0].id}`} className="group flex min-w-0 items-center gap-3">
                          <div className="min-w-0 text-right">
                            <div className="truncate text-sm text-fg/80 group-hover:underline">{c.voiceActors[0].name.full}</div>
                            <div className="text-xs text-muted">Japanese</div>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.voiceActors[0].image.large} alt="" loading="lazy" className="h-11 w-11 rounded-full object-cover" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {order && (
              <section>
                <SectionHeading title="Watch order" />
                <ol className="relative space-y-1.5 border-l border-white/[0.08] pl-5">
                  {order.map((o, i) => {
                    const current = o.node.id === id;
                    return (
                      <li key={o.node.id} className="relative">
                        <span className={`absolute -left-[25px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-4 ring-bg ${current ? "bg-accent" : o.main ? "bg-white/40" : "bg-white/15"}`} />
                        <Link href={`/anime/${o.node.id}`} className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${current ? "bg-accent/[0.07]" : "hover:bg-white/[0.04]"}`}>
                          <span className="w-5 font-mono text-xs text-muted">{i + 1}</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={o.node.coverImage.large} alt="" loading="lazy" className="h-12 w-9 rounded object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{ui.title(o.node.title)}</div>
                            <div className="font-mono text-[11px] text-muted">
                              {[prettyEnum(o.node.format), o.node.startDate.year, o.node.episodes ? `${o.node.episodes} eps` : null].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          {!o.main && <span className="chip !py-0 !text-[10px]">Optional</span>}
                          {current && <span className="chip !py-0 !text-[10px] !text-accent">You&apos;re here</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {watchedShow && showDaily && (
              <section>
                <SectionHeading title="Your viewing" />
                <ActivityGrid activity={showDaily} />
              </section>
            )}

            <Reviews anilistId={id} />

            <Comments anilistId={id} loggedIn={!!userId} />
          </div>

          <aside className="space-y-10 lg:sticky lg:top-24 lg:self-start">
            <EntryPanel anilistId={id} title={title} coverImage={m.coverImage.large} total={total} initial={entry} finish={finish} />

            {friends && (
              <div className="panel rounded-2xl p-4">
                <div className="label mb-2">Friends</div>
                <p className="text-sm">
                  {friends.completed > 0 && `${friends.completed} finished`}
                  {friends.completed > 0 && friends.watching > 0 && " · "}
                  {friends.watching > 0 && `${friends.watching} watching`}
                  {!friends.completed && !friends.watching && `${friends.total} have this on their list`}
                  {friends.avgScore ? <span className="text-muted"> · avg ★ {friends.avgScore.toFixed(1)}</span> : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {friends.people.map((p) => (
                    <Link key={p.username} href={`/u/${p.username}`} className="flex items-center gap-1.5 rounded-full bg-white/[0.05] py-0.5 pl-0.5 pr-2 text-xs hover:bg-white/[0.1]" title={isStatus(p.status) ? STATUS_LABEL[p.status] : p.status}>
                      <Avatar name={p.username} color={p.avatarColor} avatar={p.avatar} size={20} />
                      {p.username}
                      {isStatus(p.status) && <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} />}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <dl className="divide-y divide-white/[0.05] text-sm">
              {info
                .filter(([, v]) => v)
                .map(([k, v]) =>
                  k === "Studio" && m.studios.nodes.length ? (
                    <div key={k} className="flex justify-between gap-4 py-2.5">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right">
                        {m.studios.nodes.map((s, i) => (
                          <span key={s.id}>
                            {i > 0 && ", "}
                            <Link href={`/studio/${s.id}`} className="hover:underline">{s.name}</Link>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ) : (
                    <div key={k} className="flex justify-between gap-4 py-2.5">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right">{v}</dd>
                    </div>
                  ),
                )}
            </dl>

            {streaming.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Official streaming</h3>
                <div className="space-y-1">
                  {streaming.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/[0.05]"
                    >
                      {l.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.icon} alt="" className="h-5 w-5 rounded p-0.5" style={{ background: l.color ?? "transparent" }} />
                      ) : (
                        <span className="h-5 w-5 rounded bg-white/10" />
                      )}
                      {l.site}
                      <ArrowUpRight className="ml-auto h-4 w-4 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {relations.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Related</h3>
                <div className="space-y-1">
                  {relations.map((r) => (
                    <Link key={r.node.id} href={`/anime/${r.node.id}`} className="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-white/[0.05]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.node.coverImage.large} alt="" loading="lazy" className="h-14 w-10 rounded object-cover" />
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wider text-muted">{prettyEnum(r.relationType)}</div>
                        <div className="line-clamp-2 text-sm">{ui.title(r.node.title)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-[1400px] space-y-14 px-4 md:px-8">
        {recs.length > 0 && <MediaGrid title="More like this" items={recs.filter((r) => !(ui.prefs.hideEcchi && r.genres.includes("Ecchi")))} />}
        {similarShown.length > 0 && <MediaGrid title={`Similar by tags · ${topTags.join(" + ")}`} items={similarShown} />}
      </div>
    </div>
  );
}
