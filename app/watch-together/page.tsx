import Link from "next/link";
import type { Metadata } from "next";
import { Lock, Radio, Users } from "lucide-react";
import { getUserId } from "@/lib/auth";
import { captchaSiteKey } from "@/lib/captcha";
import { pageMeta } from "@/lib/seo";
import { publicRooms } from "@/lib/rooms";
import { getSnapshots } from "@/lib/media";
import { Avatar } from "@/components/UserMenu";
import RoleIcon from "@/components/RoleIcon";
import { CreateRoom, JoinByCode } from "@/components/rooms/Lobby";

export const metadata: Metadata = pageMeta({ title: "Watch Anime Together: Free Anime Watch Party", description: "Watch anime with friends in sync, with a chat on the side. Join a public watch party or start a private room with a code. Free, no ads.", path: "/watch-together", keywords: ["watch anime together", "anime watch party", "watch anime with friends", "anime watch together online"] });
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ anime?: string; ep?: string }> };

export default async function WatchTogetherPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [userId, rooms] = await Promise.all([getUserId(), publicRooms()]);
  // "Watch together" from an episode page: start a room with that episode picked.
  const animeId = Number(sp.anime) || 0;
  const snap = animeId > 0 ? (await getSnapshots([animeId])).get(animeId) : undefined;
  const preset = snap ? { anime: { id: animeId, title: snap.title, cover: snap.coverImage }, episode: Math.max(1, Math.min(5000, Number(sp.ep) || 1)) } : undefined;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-8 md:px-8 md:pt-10">
      <h1 className="text-3xl font-semibold tracking-tight">Watch together</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">Watch the same episode as your friends with a chat on the side. The host picks what&apos;s on, and everyone can sync to where they are.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4 text-accent" /> Public rooms
            <span className="font-mono text-[11px] text-muted">{rooms.length}</span>
          </h2>
          {rooms.length === 0 ? (
            <div className="panel rounded-xl p-8 text-center text-sm text-muted">
              No public rooms right now.{userId ? " Start one and it'll show up here." : " Log in to start one."}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {rooms.map((r) => (
                <li key={r.code}>
                  <Link href={`/watch-together/${r.code}`} className="panel group flex gap-3 rounded-xl p-3 transition-colors hover:border-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.animeCover} alt="" className="h-24 w-16 shrink-0 rounded-lg object-cover" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="truncate text-sm font-medium group-hover:underline">{r.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {r.animeTitle} · Ep {r.episode}
                      </div>
                      <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted">
                        <Avatar name={r.host.username} color={r.host.avatarColor} avatar={r.host.avatar} size={18} />
                        <span className="truncate">{r.host.username}</span>
                        <RoleIcon role={r.host.role} />
                        <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[11px]">
                          {r.playing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" aria-label="Playing" />}
                          <Users className="h-3 w-3" /> {r.watching}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <JoinByCode />
          {userId ? (
            <CreateRoom captchaKey={captchaSiteKey()} preset={preset} />
          ) : (
            <div className="panel rounded-xl p-4 text-sm text-muted">
              <Link href={`/login?next=${encodeURIComponent(animeId ? `/watch-together?anime=${animeId}&ep=${sp.ep ?? 1}` : "/watch-together")}`} className="text-fg underline-offset-2 hover:underline">
                Log in
              </Link>{" "}
              to start a room. You can watch public rooms without an account.
            </div>
          )}
          <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-muted">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" /> Private rooms aren&apos;t listed: only people with the code can get in. The same rules apply in room chats, and you can
            report messages.
          </p>
        </aside>
      </div>
    </div>
  );
}
