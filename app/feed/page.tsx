import Link from "next/link";
import type { Metadata } from "next";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pageMeta } from "@/lib/seo";
import PostFeed from "@/components/posts/Posts";

export const metadata: Metadata = pageMeta({ title: "Feed", description: "Posts and anime recommendations from the AniKumo community.", path: "/feed" });

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function FeedPage({ searchParams }: Props) {
  const me = await getUserId();
  const sp = await searchParams;
  const following = me ? await prisma.follow.count({ where: { followerId: me } }) : 0;
  // Logged-out visitors (and people who follow nobody yet) start on Everyone.
  const tab = sp.tab === "everyone" || !me || (!sp.tab && following === 0) ? "everyone" : "following";

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
      <p className="mt-1 text-sm text-muted">What people are watching and recommending.</p>

      <nav aria-label="Feed" className="mt-6 flex gap-1 border-b border-white/[0.06]">
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
              href={`/feed?tab=${key}`}
              aria-current={active ? "page" : undefined}
              className={`relative px-3 pb-3 pt-1 text-sm transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
              {active && <span className="absolute inset-x-0 -bottom-px h-px bg-fg" />}
            </Link>
          );
        })}
      </nav>

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
          key={tab}
          source={{ feed: tab }}
          canPost={!!me}
          empty={tab === "following" ? "Nothing here yet — posts from you and people you follow show up here." : "No posts yet. Be the first!"}
        />
      </div>
    </div>
  );
}
