import Link from "next/link";
import { notFound } from "next/navigation";

import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Award, Eye, Heart, Lock, MessageSquare, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { getUserId, roleOf } from "@/lib/auth";
import { getAccountStats } from "@/lib/account";
import { computeAchievements } from "@/lib/achievements";
import { getSnapshots } from "@/lib/media";
import { formatDuration } from "@/lib/watchtime";
import { canViewProfile, parseSections, type Sections } from "@/lib/privacy";
import { Avatar } from "@/components/UserMenu";
import FollowButton from "@/components/FollowButton";
import SpoilerText from "@/components/SpoilerText";
import PostFeed from "@/components/posts/Posts";
import RoleIcon from "@/components/RoleIcon";
import ProfileWall from "@/components/profile/ProfileWall";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string; before?: string; preview?: string }> };

const PAGE = 20;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = await prisma.user.findUnique({ where: { username }, select: { profileVisibility: true, searchable: true, bannedAt: true, bio: true } });
  const visible = u?.profileVisibility === "everyone" && !u.bannedAt;
  return pageMeta({
    title: `${username}'s anime list`,
    description: (visible && u?.bio ? u.bio : `${username}'s anime profile on AniKumo: watchlist, favourites, reviews and stats.`).slice(0, 160),
    path: `/u/${username}`,
    type: "profile",
    noindex: !visible || !u?.searchable,
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
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
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

function ago(d: Date) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const sp = await searchParams;
  const viewerId = await getUserId();
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, avatarColor: true, avatar: true, bio: true, createdAt: true, bannedAt: true,
      profileVisibility: true, profileSections: true, profileBanner: true, allowFollows: true, profileComments: true, isAdmin: true, isModerator: true,
      _count: { select: { followers: true, following: true, comments: true, posts: true } },
    },
  });
  if (!user || (user.bannedAt && viewerId !== user.id)) notFound();
  const isOwner = viewerId === user.id;
  // Owners can preview their profile the way visitors see it.
  const asVisitor = !isOwner || sp.preview === "1";

  const follow = viewerId && !isOwner ? await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: user.id } } }) : null;

  if (!(await canViewProfile(user, viewerId))) {
    if (user.profileVisibility !== "followers") notFound();
    return <LockedProfile user={user} loggedIn={!!viewerId} following={!!follow} />;
  }

  const show: Sections = asVisitor ? parseSections(user.profileSections) : parseSections("{}");
  const tab = sp.tab === "comments" && show.comments ? "comments" : sp.tab === "posts" && show.posts ? "posts" : "overview";
  const tabs = [
    ["overview", "Overview", ""],
    ...(show.posts ? [["posts", "Posts", user._count.posts ? String(user._count.posts) : ""]] : []),
    ...(show.comments ? [["comments", "Comments", user._count.comments ? String(user._count.comments) : ""]] : []),
  ] as [string, string, string][];

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 md:px-8 md:pt-8">
      {isOwner && user.profileVisibility !== "everyone" && !sp.preview && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <Eye className="h-4 w-4" />
          {user.profileVisibility === "private" ? "Only you can see this." : "Only your followers can see this."}
          <Link href="/account/settings#visibility" className="underline">
            Privacy settings
          </Link>
        </div>
      )}
      {isOwner && sp.preview === "1" && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-fg/80">
          <Eye className="h-4 w-4" /> This is how visitors see your profile.
          <Link href={`/u/${user.username}`} className="ml-auto underline">
            Exit preview
          </Link>
        </div>
      )}

      <header>
        <div className="relative -mx-4 aspect-[3/1] overflow-hidden bg-white/[0.03] sm:mx-0 sm:aspect-[4/1] sm:rounded-2xl">
          {user.profileBanner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profileBanner} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: `radial-gradient(120% 140% at 15% 0%, ${user.avatarColor}55, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-transparent" />
        </div>
        <div className="relative -mt-10 flex flex-wrap items-end gap-4 px-1 sm:-mt-12 sm:px-5">
          <div className="rounded-full ring-4 ring-bg">
            <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} size={84} />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{user.username}</h1>
              <RoleIcon role={roleOf(user)} label />
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {show.follows && `${user._count.followers} followers · ${user._count.following} following · `}
              joined {user.createdAt.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2 pb-1">
            {isOwner ? (
              <>
                {!sp.preview && (
                  <Link href={`/u/${user.username}?preview=1`} className="btn btn-ghost">
                    <Eye className="h-4 w-4" /> <span className="hidden sm:inline">View as visitor</span>
                  </Link>
                )}
                <Link href="/account/settings#visibility" className="btn btn-ghost">
                  Edit profile
                </Link>
              </>
            ) : user.allowFollows || follow ? (
              <FollowButton username={user.username} initial={!!follow} />
            ) : null}
          </div>
        </div>
        {user.bio && <p className="mt-3 max-w-xl px-1 text-sm text-fg/75 sm:px-5">{user.bio}</p>}
      </header>

      {tabs.length > 1 && (
        <nav aria-label="Profile" className="mt-6 flex gap-1 border-b border-white/[0.06]">
          {tabs.map(([key, label, count]) => {
            const q = new URLSearchParams();
            if (key !== "overview") q.set("tab", key);
            if (sp.preview === "1") q.set("preview", "1");
            const active = tab === key;
            return (
              <Link
                key={key}
                href={`/u/${user.username}${q.size ? `?${q}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-1.5 px-3 pb-3 pt-1 text-sm transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
              >
                {label}
                {count && <span className="font-mono text-[11px] text-muted">{count}</span>}
                {active && <span className="absolute inset-x-0 -bottom-px h-px bg-fg" />}
              </Link>
            );
          })}
        </nav>
      )}

      {tab === "comments" ? (
        <CommentHistory userId={user.id} username={user.username} before={sp.before} preview={sp.preview === "1"} />
      ) : tab === "posts" ? (
        <div className="mx-auto mt-6 max-w-2xl">
          <PostFeed source={{ username: user.username }} canPost={isOwner && sp.preview !== "1"} empty={isOwner ? "Share what you're watching, or recommend a show to your followers." : `${user.username} hasn't posted yet.`} />
        </div>
      ) : (
        <Overview user={user} show={show} wall={<ProfileWall username={user.username} isOwner={isOwner && sp.preview !== "1"} loggedIn={!!viewerId} />} />
      )}
    </div>
  );
}

async function Overview({ user, show, wall }: { user: { id: string; username: string; _count: { following: number } }; show: Sections; wall: React.ReactNode }) {
  const [stats, favorites, watching, completed, lists, reviews, completedIds, listCount] = await Promise.all([
    getAccountStats(user.id),
    show.favorites ? prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { addedAt: "desc" }, take: 8 }) : [],
    show.watching ? prisma.listEntry.findMany({ where: { userId: user.id, status: "WATCHING" }, orderBy: { updatedAt: "desc" }, take: 8 }) : [],
    show.completed ? prisma.listEntry.findMany({ where: { userId: user.id, status: "COMPLETED" }, orderBy: [{ score: "desc" }, { completedAt: "desc" }], take: 16 }) : [],
    show.lists
      ? prisma.customList.findMany({ where: { userId: user.id, isPublic: true }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { items: true } }, items: { take: 3, orderBy: { position: "asc" }, select: { coverImage: true } } } })
      : [],
    show.reviews ? prisma.review.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }) : [],
    prisma.listEntry.findMany({ where: { userId: user.id, status: "COMPLETED" }, select: { anilistId: true } }),
    prisma.customList.count({ where: { userId: user.id } }),
  ]);
  const snaps = await getSnapshots([...completedIds.map((c) => c.anilistId), ...reviews.map((r) => r.anilistId)]);
  const longest = Math.max(0, ...completedIds.map((c) => snaps.get(c.anilistId)?.episodes ?? 0));
  const earned = show.achievements ? computeAchievements(stats, { longestCompletedEpisodes: longest, customLists: listCount, following: user._count.following }).filter((a) => a.earned) : [];

  const tiles: [string, string][] = [
    ["Watch time", formatDuration(stats.secondsWatched)],
    ["Episodes", String(stats.episodesWatched)],
    ["Completed", String(stats.showsCompleted)],
    ["Longest streak", `${stats.longestStreak}d`],
  ];
  const empty = !show.stats && !earned.length && !favorites.length && !watching.length && !completed.length && !lists.length && !reviews.length;

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
      {show.stats && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
          {tiles.map(([k, v]) => (
            <div key={k} className="bg-bg p-4">
              <div className="text-xl font-semibold tabular-nums">{v}</div>
              <div className="text-xs text-muted">{k}</div>
            </div>
          ))}
        </div>
      )}

      {earned.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {earned.map((a) => (
            <span key={a.id} className="chip" title={a.detail}>
              <Award className="h-3 w-3 text-accent" /> {a.label}
            </span>
          ))}
        </div>
      )}

      <div className={`space-y-10 ${show.stats || earned.length ? "mt-10" : ""}`}>
        {empty && <p className="panel rounded-xl p-8 text-center text-sm text-muted">{user.username} keeps their profile details private.</p>}
        <Shelf title="Watching" items={watching} />
        <Shelf title="Favorites" items={favorites} />
        <Shelf title="Completed" items={completed} />

        {lists.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium">Lists</h2>
            <div className="grid gap-3 sm:grid-cols-2">
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
      <aside className="min-w-0">{wall}</aside>
    </div>
  );
}

/** Everything they've said in episode and show discussions, newest first. */
async function CommentHistory({ userId, username, before, preview }: { userId: string; username: string; before?: string; preview: boolean }) {
  const cursor = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null;
  const rows = await prisma.comment.findMany({
    where: { userId, ...(cursor ? { createdAt: { lt: cursor } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    select: { id: true, anilistId: true, episode: true, body: true, createdAt: true, editedAt: true, parentId: true, _count: { select: { likes: true, replies: true } } },
  });
  const more = rows.length > PAGE;
  const comments = rows.slice(0, PAGE);
  const snaps = await getSnapshots([...new Set(comments.map((c) => c.anilistId))]);

  if (!comments.length)
    return <p className="panel mt-8 rounded-xl p-8 text-center text-sm text-muted">{cursor ? "That's everything." : `${username} hasn't commented yet.`}</p>;

  const older = new URLSearchParams({ tab: "comments", before: comments.at(-1)!.createdAt.toISOString() });
  if (preview) older.set("preview", "1");

  return (
    <div className="mt-6">
      <ul className="space-y-3">
        {comments.map((c) => {
          const s = snaps.get(c.anilistId);
          const href = c.episode ? `/watch/${c.anilistId}/${c.episode}#comment-${c.id}` : `/anime/${c.anilistId}#comment-${c.id}`;
          return (
            <li key={c.id} className="panel flex gap-3 rounded-xl p-3">
              <Link href={`/anime/${c.anilistId}`} className="shrink-0">
                {s ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.coverImage} alt="" className="h-16 w-11 rounded object-cover" />
                ) : (
                  <div className="h-16 w-11 rounded bg-white/[0.05]" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <Link href={`/anime/${c.anilistId}`} className="truncate font-medium hover:underline">
                    {s?.title ?? "Anime"}
                  </Link>
                  <Link href={href} className="font-mono text-[11px] text-muted hover:text-fg">
                    {c.episode ? `Episode ${c.episode}` : "Discussion"}
                    {c.parentId ? " · reply" : ""} · {ago(c.createdAt)}
                    {c.editedAt ? " · edited" : ""}
                  </Link>
                </div>
                <SpoilerText text={c.body} className="mt-1 line-clamp-4 text-sm leading-relaxed text-fg/85" />
                <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] text-muted">
                  {c._count.likes > 0 && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" /> {c._count.likes}
                    </span>
                  )}
                  {c._count.replies > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {c._count.replies}
                    </span>
                  )}
                  <Link href={href} className="ml-auto hover:text-fg">
                    View in thread →
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {more && (
        <div className="mt-6 text-center">
          <Link href={`/u/${username}?${older}`} className="btn btn-ghost">
            Older comments
          </Link>
        </div>
      )}
    </div>
  );
}

function LockedProfile({ user, loggedIn, following }: { user: { username: string; avatarColor: string; avatar: string; allowFollows: boolean }; loggedIn: boolean; following: boolean }) {
  return (
    <div className="mx-auto max-w-md px-4 pt-20 text-center">
      <div className="mx-auto w-fit">
        <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} size={72} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{user.username}</h1>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
        <Lock className="h-3.5 w-3.5" /> Only {user.username}&apos;s followers can see this profile.
      </p>
      <div className="mt-6">
        {!loggedIn ? (
          <Link href={`/login?next=/u/${user.username}`} className="btn btn-primary">
            Log in to follow
          </Link>
        ) : user.allowFollows || following ? (
          <FollowButton username={user.username} initial={following} />
        ) : (
          <p className="text-xs text-muted">They aren&apos;t accepting new followers right now.</p>
        )}
      </div>
    </div>
  );
}
