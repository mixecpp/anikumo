import Link from "next/link";
import { notFound } from "next/navigation";

import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Award, Eye, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { getAccountStats } from "@/lib/account";
import { computeAchievements } from "@/lib/achievements";
import { getSnapshots } from "@/lib/media";
import { formatDuration } from "@/lib/watchtime";
import { Avatar } from "@/components/UserMenu";
import FollowButton from "@/components/FollowButton";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = await prisma.user.findUnique({ where: { username }, select: { profilePublic: true, bannedAt: true, bio: true } });
  const visible = !!u?.profilePublic && !u.bannedAt;
  return pageMeta({
    title: `${username}'s anime list`,
    description: (visible && u?.bio ? u.bio : `${username}'s anime profile on AniKumo: watchlist, favourites, reviews and stats.`).slice(0, 160),
    path: `/u/${username}`,
    type: "profile",
    noindex: !visible,
  });
}

function Shelf({ title, items, href }: { title: string; items: { anilistId: number; title: string; coverImage: string; score?: number | null }[]; href?: string }) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {href && <Link href={href} className="text-xs text-muted hover:text-fg">See all</Link>}
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
        {items.map((i) => (
          <Link key={i.anilistId} href={`/anime/${i.anilistId}`} className="group" title={i.title}>
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.coverImage} alt={i.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
              {i.score ? <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 font-mono text-[10px] text-[#fff]">★{i.score}</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const viewerId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, avatarColor: true, avatar: true, bio: true, profilePublic: true, createdAt: true, _count: { select: { followers: true, following: true } } },
  });
  if (!user) notFound();
  const isOwner = viewerId === user.id;
  if (!user.profilePublic && !isOwner) notFound();

  const [stats, favorites, watching, completed, lists, reviews, follow, completedIds, listCount] = await Promise.all([
    getAccountStats(user.id),
    prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { addedAt: "desc" }, take: 8 }),
    prisma.listEntry.findMany({ where: { userId: user.id, status: "WATCHING" }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.listEntry.findMany({ where: { userId: user.id, status: "COMPLETED" }, orderBy: [{ score: "desc" }, { completedAt: "desc" }], take: 16 }),
    prisma.customList.findMany({ where: { userId: user.id, isPublic: true }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { items: true } }, items: { take: 3, orderBy: { position: "asc" }, select: { coverImage: true } } } }),
    prisma.review.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    viewerId && !isOwner ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: user.id } } }) : null,
    prisma.listEntry.findMany({ where: { userId: user.id, status: "COMPLETED" }, select: { anilistId: true } }),
    prisma.customList.count({ where: { userId: user.id } }),
  ]);
  const snaps = await getSnapshots([...completedIds.map((c) => c.anilistId), ...reviews.map((r) => r.anilistId)]);
  const longest = Math.max(0, ...completedIds.map((c) => snaps.get(c.anilistId)?.episodes ?? 0));
  const earned = computeAchievements(stats, { longestCompletedEpisodes: longest, customLists: listCount, following: user._count.following }).filter((a) => a.earned);

  const tiles: [string, string][] = [
    ["Watch time", formatDuration(stats.secondsWatched)],
    ["Episodes", String(stats.episodesWatched)],
    ["Completed", String(stats.showsCompleted)],
    ["Longest streak", `${stats.longestStreak}d`],
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 md:px-8">
      {isOwner && !user.profilePublic && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <Eye className="h-4 w-4" /> Only you can see this. <Link href="/account/settings#profile" className="underline">Make your profile public</Link> to share it.
        </div>
      )}
      <header className="flex flex-wrap items-center gap-5">
        <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{user.username}</h1>
          {user.bio && <p className="mt-1 max-w-xl text-sm text-fg/75">{user.bio}</p>}
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {user._count.followers} followers · {user._count.following} following · joined {user.createdAt.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </p>
        </div>
        {isOwner ? (
          <Link href="/account/settings#profile" className="btn btn-ghost">
            Edit profile
          </Link>
        ) : (
          <FollowButton username={user.username} initial={!!follow} />
        )}
      </header>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="bg-bg p-4">
            <div className="text-xl font-semibold tabular-nums">{v}</div>
            <div className="text-xs text-muted">{k}</div>
          </div>
        ))}
      </div>

      {earned.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {earned.map((a) => (
            <span key={a.id} className="chip" title={a.detail}>
              <Award className="h-3 w-3 text-accent" /> {a.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-10 space-y-10">
        <Shelf title="Watching" items={watching} />
        <Shelf title="Favorites" items={favorites} />
        <Shelf title="Completed" items={completed} />

        {lists.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">Lists</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((l) => (
                <Link key={l.id} href={`/u/${user.username}/lists/${l.id}`} className="panel flex items-center gap-3 rounded-xl p-3 transition-colors hover:border-white/15">
                  <div className="flex -space-x-4">
                    {l.items.map((i, k) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={k} src={i.coverImage} alt="" className="h-14 w-10 rounded object-cover ring-2 ring-panel" />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{l.title}</div>
                    <div className="font-mono text-[11px] text-muted">{l._count.items} shows</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {reviews.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">Reviews</h2>
            <ul className="space-y-3">
              {reviews.map((r) => {
                const s = snaps.get(r.anilistId);
                return (
                  <li key={r.id} className="panel flex gap-3 rounded-xl p-3">
                    {s && (
                      <Link href={`/anime/${r.anilistId}`} className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.coverImage} alt="" className="h-16 w-11 rounded object-cover" />
                      </Link>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <Link href={`/anime/${r.anilistId}`} className="truncate font-medium hover:underline">
                          {s?.title ?? "Anime"}
                        </Link>
                        <span className="flex items-center gap-0.5 font-mono text-xs">
                          <Star className="h-3 w-3 fill-star text-star" /> {r.score}
                        </span>
                      </div>
                      {r.title && <div className="mt-0.5 text-sm text-fg/85">{r.title}</div>}
                      <p className="mt-1 line-clamp-3 text-sm text-muted">{r.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
