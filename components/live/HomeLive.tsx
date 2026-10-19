import Link from "next/link";
import { ArrowRight, Popcorn, Trophy } from "lucide-react";
import { messagesSince, onlineCount } from "@/lib/chat";
import { publicRooms } from "@/lib/rooms";
import { Avatar } from "../UserMenu";
import RoleIcon from "../RoleIcon";
import TimeAgo from "../TimeAgo";
import OpenChatButton, { OnlineNow } from "./OpenChatButton";

/** Home page: the community, live. The latest chat messages and the Watch Together rooms running now. */
export default async function HomeLive() {
  const [messages, rooms] = await Promise.all([messagesSince(null).catch(() => []), publicRooms().catch(() => [])]);
  const recent = messages.filter((m) => m.body && !m.body.includes("||")).slice(-4);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Live on AniKumo</h2>
          <div className="mt-1">
            <OnlineNow initial={onlineCount()} />
          </div>
        </div>
        <Link href="/leaderboard" className="flex shrink-0 items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
          <Trophy className="h-4 w-4" /> Leaderboard
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="panel flex flex-col rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Live chat</h3>
            <span className="text-[11px] text-muted">Everyone, in real time</span>
          </div>
          {recent.length === 0 ? (
            <p className="flex-1 py-4 text-sm text-muted">It is quiet right now. Be the first to say hi.</p>
          ) : (
            <ul className="flex-1 space-y-2.5">
              {recent.map((m) => (
                <li key={m.id} className="flex items-start gap-2.5">
                  <Avatar name={m.author.username} color={m.author.avatarColor} avatar={m.author.avatar} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[12px]">
                      <span className="truncate font-medium">{m.author.username}</span>
                      <RoleIcon role={m.author.role} />
                      <TimeAgo iso={m.createdAt} className="ml-auto shrink-0 font-mono text-[10px] text-muted" />
                    </div>
                    <p className="line-clamp-2 break-words text-[13px] leading-snug text-fg/80">{m.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <OpenChatButton className="btn btn-primary mt-4 w-full gap-2 !py-2 text-sm" />
        </div>

        <div className="panel flex flex-col rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Watching together</h3>
            <Link href="/watch-together" className="text-[11px] text-muted hover:text-fg">
              All rooms
            </Link>
          </div>
          {rooms.length === 0 ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-3 py-2">
              <p className="text-sm text-muted">No public rooms right now. Start one and watch in sync with friends.</p>
            </div>
          ) : (
            <ul className="flex-1 space-y-1">
              {rooms.slice(0, 3).map((r) => (
                <li key={r.code}>
                  <Link href={"/watch-together/" + r.code} className="-mx-1.5 flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-white/[0.04]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.animeCover ? <img src={r.animeCover} alt="" className="h-12 w-8 shrink-0 rounded object-cover" /> : <span className="h-12 w-8 shrink-0 rounded bg-white/[0.05]" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {r.animeTitle} · Ep {r.episode} · {r.watching} watching
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/watch-together" className="btn btn-ghost mt-4 w-full gap-2 !py-2 text-sm">
            <Popcorn className="h-4 w-4" /> Start a room <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
