"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Globe,
  LoaderCircle,
  Lock,
  LogOut,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Send,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { decodePlayerMessage } from "@/lib/playback/source";
import type { Role } from "@/lib/roles";
import PlayerSlot from "../player/PlayerSlot";
import type { WatchProps } from "../player/context";
import { Avatar } from "../UserMenu";
import RoleIcon from "../RoleIcon";
import ReportButton from "../ReportButton";
import SpoilerText from "../SpoilerText";
import { usePrefs } from "../PrefsProvider";
import { AnimePicker } from "./Lobby";

type Person = { id: string; username: string; avatarColor: string; avatar: string; role: Role };
type Message = { id: string; body: string; createdAt: string; author: Person };
type RoomState = {
  code: string;
  name: string;
  isPublic: boolean;
  anilistId: number;
  episode: number;
  animeTitle: string;
  animeCover: string;
  position: number;
  positionAt: number;
  playing: boolean;
  chatOn: boolean;
  hostId: string;
  hostAway: boolean;
};
type Poll = { serverNow: number; room: RoomState; members: Person[]; guests: number; messages: Message[]; me: { id: string; isHost: boolean; member: boolean; kicked: boolean; staff: boolean } | null };
type PlayerProps = WatchProps & { href: string; image: string };

const POLL_MS = 2500;
const DRIFT_SHOW = 10;
const DRIFT_AUTO = 20;

async function act(code: string, body: object) {
  const res = await fetch(`/api/rooms/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Something went wrong", "error");
  return res.ok;
}

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/**
 * Watch Together room. Polls the room every few seconds for its state, people and chat.
 * The host's player position is read from the embedded player's own messages and shared;
 * everyone else sees how far off they are and can sync (which reloads their player at the
 * host's time). Changing the episode (host only) moves everyone to it.
 */
export default function RoomClient({ code, player, episodes }: { code: string; player: PlayerProps; episodes: number[] }) {
  const router = useRouter();
  const { loggedIn } = usePrefs();
  const [data, setData] = useState<Poll | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [closed, setClosed] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [tab, setTab] = useState<"chat" | "people">("chat");
  const [syncKey, setSyncKey] = useState<string | undefined>(undefined);
  const [resumeAt, setResumeAt] = useState(player.resumeAt);
  const [autoSync, setAutoSync] = useState(false);
  const [, tick] = useState(0);
  const cursor = useRef<string | null>(null);
  const skew = useRef(0);
  const local = useRef<{ current: number; at: number; playing: boolean } | null>(null);
  const lastSync = useRef(0);
  const joined = useRef(false);

  // ── Polling ──
  const poll = useCallback(async () => {
    const res = await fetch(`/api/rooms/${code}${cursor.current ? `?since=${encodeURIComponent(cursor.current)}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    if (res.status === 404) return setClosed(true);
    if (!res.ok) return;
    const json: Poll = await res.json();
    skew.current = Date.now() - json.serverNow;
    setData(json);
    if (json.messages.length) {
      cursor.current = json.messages[json.messages.length - 1].createdAt;
      setMessages((m) => {
        const seen = new Set(m.map((x) => x.id));
        return [...m, ...json.messages.filter((x) => !seen.has(x.id))].slice(-200);
      });
    }
  }, [code]);

  useEffect(() => {
    poll();
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(async () => {
        await poll();
        loop();
      }, document.hidden ? POLL_MS * 4 : POLL_MS);
    };
    loop();
    return () => clearTimeout(timer);
  }, [poll]);

  // Join once we know who we are (guests just watch).
  useEffect(() => {
    if (!data?.me || joined.current || data.me.kicked) return;
    joined.current = true;
    if (!data.me.member)
      act(code, { action: "join" }).then((ok) => {
        if (ok) poll();
      });
  }, [data?.me, code, poll]);

  // The host moved to another episode or anime: load it.
  useEffect(() => {
    if (data && (data.room.anilistId !== player.anilistId || data.room.episode !== player.episode)) router.refresh();
  }, [data, player.anilistId, player.episode, router]);

  useEffect(() => {
    try {
      setAutoSync(localStorage.getItem("ak_room_autosync") === "1");
    } catch {}
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Our own player's position, from the embedded player's messages ──
  const origin = useMemo(() => {
    try {
      return player.source ? new URL(player.source.url).origin : null;
    } catch {
      return null;
    }
  }, [player.source]);
  useEffect(() => {
    if (!player.source || !origin) return;
    const source = player.source;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      let raw: unknown = e.data;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          return;
        }
      }
      const msg = decodePlayerMessage(source, raw);
      if (!msg) return;
      const prev = local.current;
      // Not every player says "playing"/"paused", so also go by whether the time is moving.
      if (msg.type === "time") local.current = { current: msg.current, at: Date.now(), playing: prev ? Math.abs(msg.current - prev.current) > 0.01 || (prev.playing && Date.now() - prev.at < 300) : true };
      // Status messages aren't reliable (some players report "Paused" while playing), so only
      // the end of the episode is taken from them; play/pause comes from the time moving.
      else if (msg.type === "status" && msg.status === "Ended" && prev) local.current = { ...prev, playing: false };
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [player.source, origin]);

  const localNow = () => {
    const l = local.current;
    if (!l || Date.now() - l.at > 15_000) return null;
    // Without a fresh time update for a few seconds, assume it's paused.
    const playing = l.playing && Date.now() - l.at < 4000;
    return { pos: l.current + (playing ? (Date.now() - l.at) / 1000 : 0), playing };
  };
  const hostNow = () => {
    if (!data) return 0;
    const r = data.room;
    return r.position + (r.playing ? Math.max(0, Date.now() - skew.current - r.positionAt) / 1000 : 0);
  };

  const isHost = !!data?.me?.isHost;

  // Host: share where we are every few seconds (and right away on play/pause).
  const lastShared = useRef<{ at: number; playing: boolean }>({ at: 0, playing: false });
  useEffect(() => {
    if (!isHost) return;
    const t = setInterval(() => {
      const l = localNow();
      if (!l) return;
      const since = Date.now() - lastShared.current.at;
      if (since < 5000 && l.playing === lastShared.current.playing) return;
      lastShared.current = { at: Date.now(), playing: l.playing };
      fetch(`/api/rooms/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "state", position: l.pos, playing: l.playing }) }).catch(() => {});
    }, 1000);
    return () => clearInterval(t);
  }, [isHost, code]);

  const sync = useCallback(() => {
    const target = hostNow();
    lastSync.current = Date.now();
    setResumeAt(Math.max(0, Math.floor(target + 2)));
    setSyncKey(String(Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const l = localNow();
  const host = hostNow();
  const drift = l ? host - l.pos : null;
  const off = !isHost && data && !data.room.hostAway && drift !== null && Math.abs(drift) > DRIFT_SHOW;

  useEffect(() => {
    if (!autoSync || isHost || drift === null || Math.abs(drift) < DRIFT_AUTO || Date.now() - lastSync.current < 25_000) return;
    sync();
  }, [autoSync, isHost, drift, sync]);

  if (closed) {
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">This room has ended</h1>
        <p className="mt-2 text-sm text-muted">The host closed it or left.</p>
        <Link href="/watch-together" className="btn btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" /> Watch together
        </Link>
      </div>
    );
  }

  const room = data?.room;
  const people = data?.members ?? [];
  const inviteLink = typeof window !== "undefined" ? `${location.origin}/watch-together/${code}` : "";

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-5 md:px-8">
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/watch-together" className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg" aria-label="All rooms">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{room?.name ?? "Watch together"}</h1>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="truncate">
              {room?.animeTitle ?? player.title} · Episode {room?.episode ?? player.episode}
            </span>
            <span className="flex items-center gap-1">
              {room?.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {room?.isPublic ? "Public" : "Private"}
            </span>
          </div>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <CopyInvite code={code} link={inviteLink} />
        {isHost && room && <HostMenu code={code} room={room} onChanged={poll} />}
        {data?.me?.member && (
          <button
            onClick={async () => {
              if (isHost && !confirm(people.length > 1 ? "Leave the room? The person who's been here longest becomes the host." : "Leave and end the room?")) return;
              if (await act(code, { action: "leave" })) router.push("/watch-together");
            }}
            className="btn btn-ghost !px-3 !py-1.5 !text-xs"
          >
            <LogOut className="h-3.5 w-3.5" /> Leave
          </button>
        )}
        <button onClick={() => setChatOpen((o) => !o)} className="hidden rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg lg:block" aria-label={chatOpen ? "Hide chat" : "Show chat"} title={chatOpen ? "Hide chat" : "Show chat"}>
          {chatOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
        </div>
      </header>

      <div className={`grid gap-5 ${chatOpen ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="min-w-0">
          <PlayerSlot {...player} resumeAt={resumeAt} syncKey={syncKey} />

          {/* Sync / host status */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
            {isHost ? (
              <span className="flex items-center gap-1.5 text-amber-200">
                <Crown className="h-3.5 w-3.5" /> You&apos;re the host — everyone follows your episode and can sync to your time.
              </span>
            ) : room?.hostAway ? (
              <span className="text-muted">The host is away. You can keep watching; sync will come back when they return.</span>
            ) : (
              <span className="text-muted">
                Host is {room?.playing ? "at" : "paused at"} <span className="font-mono text-fg">{clock(host)}</span>
                {drift !== null && <> · you&apos;re {Math.abs(drift) < 3 ? "in sync" : <span className={off ? "text-amber-200" : ""}>{Math.round(Math.abs(drift))}s {drift > 0 ? "behind" : "ahead"}</span>}</>}
              </span>
            )}
            {!isHost && (
              <>
                <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-muted">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => {
                      setAutoSync(e.target.checked);
                      try {
                        localStorage.setItem("ak_room_autosync", e.target.checked ? "1" : "0");
                      } catch {}
                    }}
                    className="accent-[var(--accent)]"
                  />
                  Auto-sync
                </label>
                <button onClick={sync} disabled={!room || room.hostAway} className={`btn !px-3 !py-1 !text-xs ${off ? "btn-primary" : "btn-ghost"}`}>
                  <RefreshCw className="h-3.5 w-3.5" /> Sync to host
                </button>
              </>
            )}
          </div>

          {isHost && room && <EpisodeControls code={code} room={room} episodes={episodes} onChanged={poll} />}
        </div>

        <AnimatePresence initial={false}>
          {chatOpen && (
            <motion.aside
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="panel flex h-[70dvh] min-h-[420px] flex-col overflow-hidden rounded-xl lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)]"
            >
              <div className="flex items-center gap-1 border-b border-white/[0.06] p-1.5">
                {(
                  [
                    ["chat", MessageSquare, "Chat"],
                    ["people", Users, `People · ${people.length + (data?.guests ?? 0)}`],
                  ] as const
                ).map(([key, Icon, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${tab === key ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg"}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              {tab === "chat" ? (
                <Chat code={code} data={data} messages={messages} setMessages={setMessages} loggedIn={loggedIn} onSent={poll} />
              ) : (
                <PeopleList code={code} data={data} onChanged={poll} />
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CopyInvite({ code, link }: { code: string; link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          if (navigator.share && matchMedia("(hover: none)").matches) await navigator.share({ url: link, title: "Watch with me on AniKumo" });
          else await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs tracking-[0.2em] transition-colors hover:border-white/20"
      title="Copy invite link"
    >
      {code}
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted" />}
    </button>
  );
}

function Chat({ code, data, messages, setMessages, loggedIn, onSent }: { code: string; data: Poll | null; messages: Message[]; setMessages: React.Dispatch<React.SetStateAction<Message[]>>; loggedIn: boolean; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const stick = useRef(true);
  const me = data?.me;

  // Stay pinned to the newest message unless you've scrolled up to read.
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    const ok = await act(code, { action: "send", body });
    setBusy(false);
    if (!ok) return;
    setBody("");
    stick.current = true;
    onSent();
  }

  const canDelete = (m: Message) => !!me && (m.author.id === me.id || me.isHost || me.staff);

  return (
    <>
      <ul
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3"
      >
        {messages.length === 0 && <li className="pt-8 text-center text-xs text-muted">No messages yet. Say hi!</li>}
        {messages.map((m) => (
          <li key={m.id} className="group flex gap-2">
            <Avatar name={m.author.username} color={m.author.avatarColor} avatar={m.author.avatar} size={24} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[12px]">
                <Link href={`/u/${m.author.username}`} className="truncate font-medium hover:underline">
                  {m.author.username}
                </Link>
                <RoleIcon role={m.author.role} />
                {m.author.id === data?.room.hostId && <Crown className="h-3 w-3 shrink-0 text-amber-300/80" aria-label="Host" />}
                <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                  {me && m.author.id !== me.id && <ReportButton targetType="room_message" targetId={m.id} />}
                  {canDelete(m) && (
                    <button
                      onClick={async () => (await act(code, { action: "deleteMessage", id: m.id })) && setMessages((ms) => ms.filter((x) => x.id !== m.id))}
                      className="rounded p-1 text-muted hover:text-fg"
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </div>
              <SpoilerText text={m.body} className="whitespace-pre-wrap break-words text-[13px] leading-snug text-fg/85" />
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/[0.06] p-2">
        {!loggedIn ? (
          <p className="px-1 py-1.5 text-xs text-muted">
            <Link href={`/login?next=/watch-together/${code}`} className="text-fg underline-offset-2 hover:underline">
              Log in
            </Link>{" "}
            to chat.
          </p>
        ) : me?.kicked ? (
          <p className="px-1 py-1.5 text-xs text-muted">The host removed you from this room&apos;s chat.</p>
        ) : data && !data.room.chatOn && !me?.isHost ? (
          <p className="flex items-center gap-1.5 px-1 py-1.5 text-xs text-muted">
            <MessageSquareOff className="h-3.5 w-3.5" /> The host turned chat off.
          </p>
        ) : (
          <form onSubmit={send} className="flex gap-2">
            <input value={body} onChange={(e) => setBody(e.target.value.slice(0, 300))} placeholder="Say something… ||spoilers|| hidden" className="input !py-2 text-sm" aria-label="Chat message" />
            <button disabled={busy || !body.trim()} className="btn btn-primary shrink-0 !px-3" aria-label="Send">
              {busy ? <LoaderCircle className="spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

function PeopleList({ code, data, onChanged }: { code: string; data: Poll | null; onChanged: () => void }) {
  const me = data?.me;
  const canManage = !!me && (me.isHost || me.staff);
  return (
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
      {(data?.members ?? []).map((p) => (
        <li key={p.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
          <Avatar name={p.username} color={p.avatarColor} avatar={p.avatar} size={28} />
          <Link href={`/u/${p.username}`} className="min-w-0 truncate text-sm hover:underline">
            {p.username}
          </Link>
          <RoleIcon role={p.role} />
          {p.id === data?.room.hostId && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
              <Crown className="h-3 w-3" /> Host
            </span>
          )}
          {canManage && p.id !== data?.room.hostId && p.id !== me?.id && (
            <span className="ml-auto flex gap-0.5 opacity-60 group-hover:opacity-100">
              {me?.isHost && (
                <button onClick={async () => confirm(`Make ${p.username} the host?`) && (await act(code, { action: "makeHost", userId: p.id })) && onChanged()} className="rounded p-1 text-muted hover:text-amber-300" title="Make host" aria-label={`Make ${p.username} the host`}>
                  <Crown className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={async () => confirm(`Remove ${p.username} from the room? They won't be able to come back.`) && (await act(code, { action: "kick", userId: p.id })) && onChanged()} className="rounded p-1 text-muted hover:text-red-300" title="Remove from room" aria-label={`Remove ${p.username}`}>
                <UserMinus className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </li>
      ))}
      {!!data?.guests && <li className="px-2 pt-2 text-xs text-muted">+ {data.guests} watching without an account</li>}
    </ul>
  );
}

function EpisodeControls({ code, room, episodes, onChanged }: { code: string; room: RoomState; episodes: number[]; onChanged: () => void }) {
  const [changing, setChanging] = useState(false);
  const list = episodes.length ? episodes : Array.from({ length: Math.max(room.episode, 12) }, (_, i) => i + 1);
  const go = async (body: object) => {
    if (await act(code, { action: "setEpisode", ...body })) {
      setChanging(false);
      onChanged();
    }
  };
  return (
    <div className="panel mt-3 rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">Now playing</span>
        <select value={room.episode} onChange={(e) => go({ episode: Number(e.target.value) })} className="input !w-auto !py-1.5 text-sm" aria-label="Episode">
          {list.map((n) => (
            <option key={n} value={n}>
              Episode {n}
            </option>
          ))}
        </select>
        {list.includes(room.episode + 1) && (
          <button onClick={() => go({ episode: room.episode + 1 })} className="btn btn-ghost !py-1.5 !text-xs">
            Next episode
          </button>
        )}
        <button onClick={() => setChanging((c) => !c)} className="btn btn-ghost ml-auto !py-1.5 !text-xs">
          {changing ? <X className="h-3.5 w-3.5" /> : null} {changing ? "Cancel" : "Change anime"}
        </button>
      </div>
      {changing && (
        <div className="mt-3">
          <AnimePicker value={null} onPick={(a) => a && go({ anilistId: a.id, episode: 1 })} />
        </div>
      )}
    </div>
  );
}

function HostMenu({ code, room, onChanged }: { code: string; room: RoomState; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const set = async (body: object) => (await act(code, { action: "settings", ...body })) && onChanged();
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg" aria-label="Room settings" aria-expanded={open}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-full z-40 mt-1 w-52 rounded-xl p-1 text-sm shadow-xl">
          <button
            onClick={() => {
              const name = prompt("Room name", room.name);
              if (name && name.trim() !== room.name) set({ name });
              setOpen(false);
            }}
            className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]"
          >
            Rename
          </button>
          <button onClick={() => (set({ isPublic: !room.isPublic }), setOpen(false))} className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]">
            {room.isPublic ? "Make private" : "Make public"}
          </button>
          <button onClick={() => (set({ chatOn: !room.chatOn }), setOpen(false))} className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]">
            {room.chatOn ? "Turn chat off" : "Turn chat on"}
          </button>
          <button
            onClick={async () => {
              setOpen(false);
              if (confirm("End the room for everyone?") && (await act(code, { action: "close" }))) location.href = "/watch-together";
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-red-300 hover:bg-red-500/10"
          >
            End room
          </button>
        </div>
      )}
    </div>
  );
}
