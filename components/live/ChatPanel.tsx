"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, CornerUpLeft, LoaderCircle, MessageSquareOff, Pin, PinOff, Popcorn, Send, Shield, Trash2, Tv, Users, X } from "lucide-react";
import { Avatar } from "../UserMenu";
import RoleIcon from "../RoleIcon";
import ReportButton from "../ReportButton";
import { usePlayerOptional } from "../player/context";
import MessageText, { mentions, preview } from "./MessageText";
import { useLive, type ChatMessage, type Person } from "./LiveProvider";

type Tab = "chat" | "people" | "rooms";
const MAX = 400;

/** The live chat window: used by the floating desktop window and the phone sheet (ChatDock). */
export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const live = useLive();
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div data-live-chat className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">Live chat</h2>
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            {live.online.toLocaleString()} online
          </p>
        </div>
        <div className="flex rounded-lg bg-white/[0.04] p-0.5 text-[11px]" role="tablist" aria-label="Chat sections">
          {(
            [
              ["chat", "Chat"],
              ["people", "People"],
              ["rooms", "Rooms"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-md px-2.5 py-1 transition-colors ${tab === id ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {live.me?.staff && <StaffMenu />}
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Close chat" title="Close chat">
          <X className="h-4 w-4" />
        </button>
      </header>
      {tab === "chat" ? <ChatTab /> : <SideTab tab={tab} />}
    </div>
  );
}

function StaffMenu() {
  const live = useLive();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const row = "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/[0.06]";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`rounded-lg p-1.5 transition-colors hover:bg-white/[0.06] ${open ? "text-fg" : "text-muted hover:text-fg"}`} aria-label="Chat controls" title="Chat controls">
        <Shield className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1.5 w-56 rounded-xl border border-line bg-panel p-1 shadow-xl">
          <button className={row} onClick={() => void live.staffAction({ action: "settings", on: !live.chatOn })}>
            {live.chatOn ? "Pause chat" : "Resume chat"}
            <span className={`text-[10px] ${live.chatOn ? "text-success" : "text-amber-300"}`}>{live.chatOn ? "Live" : "Paused"}</span>
          </button>
          <div className="px-2.5 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted">Slow mode</div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {[0, 5, 10, 30, 60, 300].map((s) => (
              <button
                key={s}
                onClick={() => void live.staffAction({ action: "settings", slowMode: s })}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors ${live.slowMode === s ? "bg-accent/15 text-accent" : "bg-white/[0.04] text-muted hover:text-fg"}`}
              >
                {s === 0 ? "Off" : s < 60 ? s + "s" : s / 60 + "m"}
              </button>
            ))}
          </div>
          {live.pinned && (
            <button className={row} onClick={() => void live.staffAction({ action: "unpin" })}>
              Unpin message <PinOff className="h-3.5 w-3.5 text-muted" />
            </button>
          )}
          <Link href="/admin/community" className={row} onClick={() => setOpen(false)}>
            Community settings
          </Link>
        </div>
      )}
    </div>
  );
}

const GROUP_MS = 3 * 60_000;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function ChatTab() {
  const live = useLive();
  const { messages } = live;
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [fresh, setFresh] = useState(0);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const before = useRef<{ height: number; top: number } | null>(null);
  const lastId = messages[messages.length - 1]?.id;

  // New messages: follow them if you are at the bottom, otherwise count them on a pill.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (before.current) {
      // Older messages were added on top: keep what you were reading in place.
      el.scrollTop = el.scrollHeight - before.current.height + before.current.top;
      before.current = null;
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
    else setFresh((n) => n + 1);
  }, [lastId, messages.length]);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live.loaded]);

  const older = async () => {
    const el = list.current;
    if (!el || loadingOlder) return;
    setLoadingOlder(true);
    before.current = { height: el.scrollHeight, top: el.scrollTop };
    await live.loadOlder();
    setLoadingOlder(false);
  };

  const jump = useCallback(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stick.current = true;
    setFresh(0);
  }, []);

  const goTo = (id: string) => {
    const node = list.current?.querySelector<HTMLElement>(`[data-msg="${CSS.escape(id)}"]`);
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    node.classList.add("bg-accent/10");
    setTimeout(() => node.classList.remove("bg-accent/10"), 1200);
  };

  return (
    <>
      {live.pinned && (
        <button onClick={() => goTo(live.pinned!.id)} className="flex items-start gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.04]">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-fg/90">{live.pinned.author.username}</span>
            <span className="line-clamp-2 text-muted">{live.pinned.body ? preview(live.pinned.body) : live.pinned.anime?.title}</span>
          </span>
        </button>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={list}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (stick.current && fresh) setFresh(0);
          }}
          className="h-full overflow-y-auto overscroll-contain py-2"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {!live.loaded ? (
            <div className="grid h-full place-items-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : (
            <>
              {live.hasOlder && messages.length >= 50 ? (
                <div className="flex justify-center py-2">
                  <button onClick={older} disabled={loadingOlder} className="rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-muted transition-colors hover:text-fg">
                    {loadingOlder ? "Loading…" : "Load earlier messages"}
                  </button>
                </div>
              ) : (
                <p className="px-4 pb-3 pt-2 text-center text-[11px] leading-relaxed text-muted">
                  Welcome to the AniKumo live chat. Keep it friendly and hide spoilers ||like this||.{" "}
                  <Link href="/rules" className="underline-offset-2 hover:text-fg hover:underline">
                    Rules
                  </Link>
                </p>
              )}
              {messages.length === 0 && <p className="pt-6 text-center text-xs text-muted">No messages yet. Say hi!</p>}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped = !!prev && prev.author.id === m.author.id && !m.replyTo && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < GROUP_MS;
                return <Message key={m.id} m={m} grouped={grouped} onReply={() => setReply(m)} onQuote={goTo} />;
              })}
            </>
          )}
        </div>
        {fresh > 0 && (
          <button onClick={jump} className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-bg shadow-lg">
            <ArrowDown className="h-3 w-3" /> New messages
          </button>
        )}
      </div>
      <Composer reply={reply} clearReply={() => setReply(null)} onSent={jump} />
    </>
  );
}

function Message({ m, grouped, onReply, onQuote }: { m: ChatMessage; grouped: boolean; onReply: () => void; onQuote: (id: string) => void }) {
  const live = useLive();
  const me = live.me;
  const mine = me?.id === m.author.id;
  const pingsMe = !mine && mentions(m.body, me?.username);
  const canDelete = !!me && (mine || me.staff);

  return (
    <div data-msg={m.id} className={`group relative flex gap-2.5 px-3 transition-colors hover:bg-white/[0.025] ${grouped ? "py-0.5" : "pb-0.5 pt-2"} ${pingsMe ? "border-l-2 border-accent bg-accent/[0.06] pl-2.5" : ""}`}>
      <div className="w-7 shrink-0">
        {!grouped && (
          <Link href={"/u/" + encodeURIComponent(m.author.username)} aria-hidden tabIndex={-1}>
            <Avatar name={m.author.username} color={m.author.avatarColor} avatar={m.author.avatar} size={28} />
          </Link>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-center gap-1.5 text-[12px] leading-5">
            <Link href={"/u/" + encodeURIComponent(m.author.username)} className="truncate font-medium hover:underline">
              {m.author.username}
            </Link>
            <RoleIcon role={m.author.role} />
            <span className="text-[10px] text-muted" title={new Date(m.createdAt).toLocaleString()} suppressHydrationWarning>
              {timeOf(m.createdAt)}
            </span>
          </div>
        )}
        {m.replyTo && (
          <button onClick={() => onQuote(m.replyTo!.id)} className="mb-0.5 flex max-w-full items-center gap-1 truncate text-left text-[11px] text-muted hover:text-fg">
            <CornerUpLeft className="h-3 w-3 shrink-0" />
            <span className="font-medium">{m.replyTo.username}</span>
            <span className="truncate">{preview(m.replyTo.body)}</span>
          </button>
        )}
        {m.body && <MessageText text={m.body} me={me?.username} className="text-[13px] leading-snug text-fg/90" />}
        {m.anime && <AnimeCard anime={m.anime} />}
      </div>
      {me && (
        <div className="absolute right-2 top-0 flex -translate-y-1/3 items-center rounded-lg border border-line bg-panel opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:static [@media(hover:none)]:translate-y-0 [@media(hover:none)]:self-start [@media(hover:none)]:border-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:opacity-60 [@media(hover:none)]:shadow-none">
          {!me.muted && (
            <button onClick={onReply} className="rounded p-1.5 text-muted hover:text-fg" aria-label={"Reply to " + m.author.username} title="Reply">
              <CornerUpLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {me.staff && (
            <button onClick={() => void live.staffAction({ action: m.pinned ? "unpin" : "pin", id: m.id })} className="rounded p-1.5 text-muted hover:text-fg" aria-label={m.pinned ? "Unpin" : "Pin message"} title={m.pinned ? "Unpin" : "Pin"}>
              {m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}
          {!mine && <ReportButton targetType="chat_message" targetId={m.id} />}
          {canDelete && (
            <button onClick={() => (mine || confirm("Delete this message?")) && void live.remove(m.id)} className="rounded p-1.5 text-muted hover:text-red-300" aria-label="Delete message" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AnimeCard({ anime }: { anime: NonNullable<ChatMessage["anime"]> }) {
  const href = anime.episode ? `/watch/${anime.id}/${anime.episode}` : `/anime/${anime.id}`;
  return (
    <Link href={href} className="mt-1 flex max-w-[260px] items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 pr-3 transition-colors hover:bg-white/[0.06]">
      {anime.cover && <Image src={anime.cover} alt="" width={32} height={46} className="h-[46px] w-8 shrink-0 rounded object-cover" unoptimized />}
      <span className="min-w-0">
        <span className="line-clamp-2 text-[12px] font-medium leading-snug">{anime.title}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted">
          <Tv className="h-3 w-3" /> {anime.episode ? "Episode " + anime.episode : "Anime"}
        </span>
      </span>
    </Link>
  );
}

function Composer({ reply, clearReply, onSent }: { reply: ChatMessage | null; clearReply: () => void; onSent: () => void }) {
  const live = useLive();
  const player = usePlayerOptional();
  const playing = player?.nowPlaying ?? null;
  const [body, setBody] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLTextAreaElement>(null);
  const me = live.me;
  const wait = Math.max(0, Math.ceil((live.slowUntil - now) / 1000));

  // Tick the slow mode countdown.
  useEffect(() => {
    if (live.slowUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [live.slowUntil]);

  useEffect(() => {
    if (reply) box.current?.focus();
  }, [reply]);
  useEffect(() => {
    if (!playing) setShare(false);
  }, [playing]);

  // Grow with the text, up to four lines.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  }, [body]);

  if (!me)
    return (
      <div className="border-t border-white/[0.06] px-3 py-3 text-center text-xs text-muted">
        <Link href="/login" className="font-medium text-fg hover:underline">
          Log in
        </Link>{" "}
        or{" "}
        <Link href="/register" className="font-medium text-fg hover:underline">
          sign up
        </Link>{" "}
        to join the conversation.
      </div>
    );
  if (me.muted)
    return (
      <p className="border-t border-white/[0.06] px-3 py-3 text-center text-xs text-muted">
        You’re muted{me.mutedUntil ? " until " + new Date(me.mutedUntil).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""}.
      </p>
    );
  if (!live.chatOn && !me.staff)
    return (
      <p className="flex items-center justify-center gap-1.5 border-t border-white/[0.06] px-3 py-3 text-xs text-muted">
        <MessageSquareOff className="h-3.5 w-3.5" /> The chat is paused by the moderators.
      </p>
    );

  const ready = (body.trim() || (share && playing)) && body.length <= MAX && !busy && !wait;
  async function submit() {
    if (!ready) return;
    setBusy(true);
    const ok = await live.send(body.trim(), { replyToId: reply?.id ?? null, anime: share && playing ? { id: playing.anilistId, episode: playing.episode } : null });
    setBusy(false);
    if (!ok) return;
    setBody("");
    setShare(false);
    clearReply();
    setNow(Date.now());
    onSent();
  }

  return (
    <div className="border-t border-white/[0.06] p-2">
      {(reply || (share && playing)) && (
        <div className="mb-1.5 space-y-1">
          {reply && (
            <Chip onClear={clearReply} label="Cancel reply">
              <CornerUpLeft className="h-3 w-3 shrink-0" /> Replying to <b className="font-medium text-fg">{reply.author.username}</b>
            </Chip>
          )}
          {share && playing && (
            <Chip onClear={() => setShare(false)} label="Remove the episode">
              <Tv className="h-3 w-3 shrink-0" /> <span className="truncate">{playing.title} · Episode {playing.episode}</span>
            </Chip>
          )}
        </div>
      )}
      <div className="flex items-end gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 pl-2.5 focus-within:border-white/20">
        <textarea
          ref={box}
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX + 50))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape" && reply) {
              e.stopPropagation();
              clearReply();
            }
          }}
          placeholder={live.slowMode ? "Message (slow mode " + live.slowMode + "s)" : "Message everyone…"}
          aria-label="Chat message"
          className="max-h-24 min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-snug outline-none placeholder:text-muted md:text-sm"
        />
        {playing && (
          <button
            type="button"
            onClick={() => setShare((s) => !s)}
            aria-pressed={share}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${share ? "bg-accent/15 text-accent" : "text-muted hover:bg-white/[0.06] hover:text-fg"}`}
            aria-label="Share what you’re watching"
            title="Share what you’re watching"
          >
            <Tv className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={() => void submit()} disabled={!ready} className="btn btn-primary h-8 shrink-0 !rounded-lg !px-2.5 text-xs" aria-label="Send">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : wait ? wait + "s" : <Send className="h-4 w-4" />}
        </button>
      </div>
      {body.length > MAX - 60 && <p className={`px-1 pt-1 text-right font-mono text-[10px] ${body.length > MAX ? "text-red-300" : "text-muted"}`}>{MAX - body.length}</p>}
    </div>
  );
}

function Chip({ children, onClear, label }: { children: React.ReactNode; onClear: () => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] py-1 pl-2 pr-1 text-[11px] text-muted">
      <span className="flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
      <button onClick={onClear} className="rounded p-0.5 hover:text-fg" aria-label={label}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

type Room = { code: string; name: string; anilistId: number; episode: number; animeTitle: string; animeCover: string; host: Person; watching: number; playing: boolean };

/** People online and the live Watch Together rooms. */
function SideTab({ tab }: { tab: "people" | "rooms" }) {
  const [data, setData] = useState<{ online: number; users: Person[]; rooms: Room[] } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/live/online", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => alive && j && setData(j))
        .catch(() => {});
    void load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!data)
    return (
      <div className="grid flex-1 place-items-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-muted" />
      </div>
    );

  if (tab === "people") {
    const guests = Math.max(0, data.online - data.users.length);
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        <p className="flex items-center gap-1.5 px-2 pb-2 pt-1 text-[11px] text-muted">
          <Users className="h-3.5 w-3.5" /> {data.users.length} signed in{guests ? " · " + guests + " browsing" : ""}
        </p>
        {data.users.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Nobody signed in right now.</p>}
        <ul>
          {data.users.map((u) => (
            <li key={u.id}>
              <Link href={"/u/" + encodeURIComponent(u.username)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.04]">
                <span className="relative">
                  <Avatar name={u.username} color={u.avatarColor} avatar={u.avatar} size={26} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-panel" />
                </span>
                <span className="truncate">{u.username}</span>
                <RoleIcon role={u.role} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <p className="text-[11px] text-muted">Public Watch Together rooms</p>
        <Link href="/watch-together" className="text-[11px] font-medium text-accent hover:underline">
          Start a room
        </Link>
      </div>
      {data.rooms.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Popcorn className="mx-auto h-6 w-6 text-muted" />
          <p className="mt-2 text-xs text-muted">No public rooms right now.</p>
          <Link href="/watch-together" className="btn btn-ghost mt-3 !py-1.5 !text-xs">
            Watch something together
          </Link>
        </div>
      ) : (
        <ul className="space-y-1">
          {data.rooms.map((r) => (
            <li key={r.code}>
              <Link href={"/watch-together/" + r.code} className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-white/[0.04]">
                {r.animeCover ? (
                  <Image src={r.animeCover} alt="" width={36} height={52} className="h-[52px] w-9 shrink-0 rounded object-cover" unoptimized />
                ) : (
                  <span className="h-[52px] w-9 shrink-0 rounded bg-white/[0.05]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{r.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {r.animeTitle} · Ep {r.episode}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${r.playing ? "bg-success" : "bg-white/30"}`} /> {r.watching} watching · hosted by {r.host.username}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
