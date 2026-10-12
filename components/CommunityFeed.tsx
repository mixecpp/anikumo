import Link from "next/link";
import { ArrowRight, Heart, MessageCircle, Sparkles } from "lucide-react";
import { listPosts } from "@/lib/posts";
import { Avatar } from "./UserMenu";
import RoleIcon from "./RoleIcon";
import SpoilerText from "./SpoilerText";
import TimeAgo from "./TimeAgo";

/** Home page strip: the newest public posts from the Everyone feed. */
export default async function CommunityFeed({ viewerId }: { viewerId: string | null }) {
  const result = await listPosts({ viewerId, scope: "everyone", take: 4 }).catch(() => null);
  const posts = result?.posts ?? [];

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">From the community</h2>
          <p className="mt-0.5 text-sm text-muted">What people are watching and recommending right now.</p>
        </div>
        <Link href="/feed?tab=everyone" className="flex shrink-0 items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
          Open feed <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {posts.length === 0 ? (
        <Link href="/feed" className="panel flex items-center justify-between gap-3 rounded-xl p-5 text-sm text-muted transition-colors hover:border-white/15 hover:text-fg">
          Nobody has posted yet — share what you&apos;re watching or recommend a show.
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      ) : (
        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
          {posts.map((p) => (
            <article key={p.id} className="panel group relative flex w-[80%] shrink-0 snap-start flex-col rounded-xl p-4 transition-colors hover:border-white/15 md:w-auto">
              {/* The whole card opens the post; the name above it still goes to the profile. */}
              <Link href={`/post/${p.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open post by ${p.author.username}`} />
              <header className="flex items-center gap-2">
                <Link href={`/u/${p.author.username}`} className="relative shrink-0">
                  <Avatar name={p.author.username} color={p.author.avatarColor} avatar={p.author.avatar} size={28} />
                </Link>
                <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
                  <Link href={`/u/${p.author.username}`} className="relative truncate font-medium hover:underline">
                    {p.author.username}
                  </Link>
                  <RoleIcon role={p.author.role} />
                </div>
                <TimeAgo iso={p.createdAt} className="shrink-0 font-mono text-[11px] text-muted" />
              </header>
              {p.body && <SpoilerText text={p.body} className="mt-2.5 line-clamp-3 break-words text-sm leading-relaxed text-fg/85" />}
              {p.anime && (
                <div className="mt-auto flex items-center gap-2.5 pt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.anime.cover} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{p.anime.title}</div>
                    {p.anime.recommend && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-accent">
                        <Sparkles className="h-3 w-3" /> Recommended
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className={`flex items-center gap-3 font-mono text-[11px] text-muted ${p.anime ? "pt-3" : "mt-auto pt-3"}`}>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {p.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> {p.comments}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
