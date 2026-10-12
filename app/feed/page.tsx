import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, Users } from "lucide-react";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pageMeta } from "@/lib/seo";
import { trendingRecommendations, whoToFollow } from "@/lib/posts";
import PostFeed from "@/components/posts/Posts";
import FollowButton from "@/components/FollowButton";
import RoleIcon from "@/components/RoleIcon";
import { Avatar } from "@/components/UserMenu";
import { TelegramLink } from "@/components/TelegramCard";

export const metadata: Metadata = pageMeta({ title: "Feed", description: "Posts and anime recommendations from the AniKumo community.", path: "/feed" });

type Props = { searchParams: Promise<{ tab?: string; show?: string }> };

export default async function FeedPage({ searchParams }: Props) {
  const me = await getUserId();
  const sp = await searchParams;
  const [following, trending, people] = await Promise.all([
    me ? prisma.follow.count({ where: { followerId: me } }) : 0,
    trendingRecommendations(5),
    whoToFollow(me, 4),
  ]);
  // Logged-out visitors (and people who follow nobody yet) start on Everyone.
  const tab = sp.tab === "everyone" || !me || (!sp.tab && following === 0) ? "everyone" : "following";
  const recs = sp.show === "recs";
  const href = (t: string, r: boolean) => `/feed?tab=${t}${r ? "&show=recs" : ""}`;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-8 md:px-8 md:pt-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
          <p className="mt-1 text-sm text-muted">What people are watching and recommending.</p>

          <div className="mt-6 flex items-end justify-between gap-3 border-b border-white/[0.06]">
            <nav aria-label="Feed" className="flex gap-1">
              {(
                [
                  ["following", "Following"],
                  ["everyone", "Everyone"],
                ] as const
              ).map(([key, label]) => {
                const active = tab === key;
                return (
                  <Link
                    key={key}
                    href={href(key, recs)}
                    aria-current={active ? "page" : undefined}
                    className={`relative px-3 pb-3 pt-1 text-sm transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
                  >
                    {label}
                    {active && <span className="absolute inset-x-0 -bottom-px h-px bg-fg" />}
                  </Link>
                );
              })}
            </nav>
            <Link
              href={href(tab, !recs)}
              aria-pressed={recs}
              className={`mb-2 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${recs ? "border-accent/40 bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-fg"}`}
            >
              <Sparkles className="h-3 w-3" /> Recommendations
            </Link>
          </div>

          <div className="mt-6">
            {!me && (
              <p className="panel mb-3 rounded-xl p-4 text-sm text-muted">
                <Link href="/login?next=/feed" className="text-fg underline-offset-2 hover:underline">
                  Log in
                </Link>{" "}
                to post, recommend anime and follow people.
              </p>
            )}
            {tab === "following" && following === 0 && (
              <p className="panel mb-3 rounded-xl p-4 text-sm text-muted">
                You&apos;re not following anyone yet. Find people in{" "}
                <Link href="/feed?tab=everyone" className="text-fg underline-offset-2 hover:underline">
                  Everyone
                </Link>{" "}
                or search for them with @name.
              </p>
            )}
            <PostFeed
              key={`${tab}-${recs}`}
              source={{ feed: tab }}
              recs={recs}
              canPost={!!me}
              empty={
                recs
                  ? "No recommendations here yet. Attach an anime to a post and tick “Recommend it”."
                  : tab === "following"
                    ? "Nothing here yet — posts from you and people you follow show up here."
                    : "No posts yet. Be the first!"
              }
            />
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {trending.length > 0 && (
            <section className="panel rounded-xl p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-accent" /> Most recommended
              </h2>
              <p className="mt-0.5 text-xs text-muted">By the community, last two weeks</p>
              <ol className="mt-3 space-y-2.5">
                {trending.map((a, i) => (
                  <li key={a.id}>
                    <Link href={`/anime/${a.id}`} className="group flex items-center gap-3">
                      <span className="w-3 font-mono text-[11px] text-muted">{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.cover} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm group-hover:underline">{a.title}</div>
                        <div className="font-mono text-[11px] text-muted">
                          {a.count} {a.count === 1 ? "recommendation" : "recommendations"}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {people.length > 0 && (
            <section className="panel rounded-xl p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="h-4 w-4 text-muted" /> People to follow
              </h2>
              <ul className="mt-3 space-y-3">
                {people.map((p) => (
                  <li key={p.username} className="flex items-center gap-2.5">
                    <Link href={`/u/${p.username}`} className="shrink-0">
                      <Avatar name={p.username} color={p.avatarColor} avatar={p.avatar} size={34} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1 text-sm">
                        <Link href={`/u/${p.username}`} className="truncate font-medium hover:underline">
                          {p.username}
                        </Link>
                        <RoleIcon role={p.role} />
                      </div>
                      <div className="truncate text-xs text-muted">{p.bio || `${p.followers} ${p.followers === 1 ? "follower" : "followers"}`}</div>
                    </div>
                    {me && <FollowButton username={p.username} initial={false} compact />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <TelegramLink text="Chat with the community off-site" />

          <p className="px-1 text-[11px] leading-relaxed text-muted">
            Keep it kind and spoiler-tagged (wrap spoilers in ||double bars||). Posts follow each person&apos;s profile privacy. <Link href="/rules" className="underline-offset-2 hover:text-fg hover:underline">Rules</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
