"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Megaphone, MessagesSquare, Trash2, UserX } from "lucide-react";
import { toast } from "@/lib/toast";
import { Avatar } from "../UserMenu";
import RoleIcon from "../RoleIcon";
import TimeAgo from "../TimeAgo";
import OpenChatButton from "../live/OpenChatButton";
import { liveAction, useLiveOptional, type ChatMessage } from "../live/LiveProvider";

type Settings = { on: boolean; slowMode: number };
type Announcement = { id: string; body: string; href: string; tone: "info" | "important"; createdAt: string; expiresAt: string; author: string; live: boolean };
type Initial = { settings: Settings; history: Announcement[]; recent: ChatMessage[]; stats: { online: number; today: number; chatters: number } };

const SLOW = [0, 5, 10, 30, 60, 300];
const DURATIONS = ["1h", "6h", "24h", "3d", "7d"] as const;
const MAX = 280;

export default function CommunityAdmin({ isAdmin, initial }: { isAdmin: boolean; initial: Initial }) {
  const router = useRouter();
  const live = useLiveOptional();
  const [settings, setSettings] = useState(initial.settings);
  const [recent, setRecent] = useState(initial.recent);

  async function save(patch: Partial<Settings>) {
    const res = await liveAction({ action: "settings", ...patch });
    if (res?.settings) {
      setSettings(res.settings as Settings);
      live?.refresh();
      toast("Chat updated");
    }
  }

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-3 gap-3">
        {[
          ["Online now", initial.stats.online],
          ["Messages today", initial.stats.today],
          ["Chatting today", initial.stats.chatters],
        ].map(([label, n]) => (
          <div key={label} className="panel rounded-xl p-4">
            <div className="text-2xl font-semibold tabular-nums tracking-tight">{Number(n).toLocaleString()}</div>
            <div className="mt-0.5 text-xs text-muted">{label}</div>
          </div>
        ))}
      </section>

      <section className="panel rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <MessagesSquare className="h-4 w-4" /> Live chat
            </h2>
            <p className="mt-1 text-xs text-muted">The floating chat on every page. Staff can always post, pin and delete.</p>
          </div>
          <OpenChatButton className="btn btn-ghost gap-2 !py-1.5 text-xs">Open the chat</OpenChatButton>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs text-muted">Status</div>
            <div className="flex rounded-lg bg-white/[0.04] p-0.5 text-sm">
              {[
                [true, "Live"],
                [false, "Paused"],
              ].map(([on, label]) => (
                <button key={String(on)} onClick={() => settings.on !== on && void save({ on: on as boolean })} className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${settings.on === on ? (on ? "bg-success/15 text-success" : "bg-amber-400/15 text-amber-300") : "text-muted hover:text-fg"}`}>
                  {label as string}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Paused: everyone can read, only staff can post.</p>
          </div>
          <div>
            <div className="mb-2 text-xs text-muted">Slow mode</div>
            <div className="flex flex-wrap gap-1">
              {SLOW.map((s) => (
                <button key={s} onClick={() => settings.slowMode !== s && void save({ slowMode: s })} className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${settings.slowMode === s ? "bg-accent/15 text-accent" : "bg-white/[0.04] text-muted hover:text-fg"}`}>
                  {s === 0 ? "Off" : s < 60 ? s + "s" : s / 60 + " min"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">How long people wait between messages.</p>
          </div>
        </div>
        {isAdmin && (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <button
              onClick={async () => {
                if (!confirm("Delete every message in the live chat? This cannot be undone.")) return;
                if (await liveAction({ action: "clear" })) {
                  setRecent([]);
                  live?.refresh();
                  toast("Chat cleared");
                }
              }}
              className="flex items-center gap-1.5 text-xs text-red-300 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear the whole chat
            </button>
          </div>
        )}
      </section>

      {isAdmin && <Announcements initial={initial.history} onChange={() => { router.refresh(); live?.refresh(); }} />}

      <section>
        <h2 className="mb-3 text-sm font-medium">Recent messages</h2>
        {recent.length === 0 ? (
          <p className="panel rounded-xl p-5 text-sm text-muted">No messages yet.</p>
        ) : (
          <ul className="panel divide-y divide-white/[0.05] rounded-xl">
            {recent.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                <Avatar name={m.author.username} color={m.author.avatarColor} avatar={m.author.avatar} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <a href={"/u/" + encodeURIComponent(m.author.username)} className="font-medium hover:underline">{m.author.username}</a>
                    <RoleIcon role={m.author.role} />
                    <TimeAgo iso={m.createdAt} className="font-mono text-[10px] text-muted" />
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-fg/85">{m.body || (m.anime ? "Shared " + m.anime.title : "")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={async () => {
                      if (!confirm("Remove every chat message from " + m.author.username + "?")) return;
                      const res = await liveAction({ action: "purge", userId: m.author.id });
                      if (res) {
                        setRecent((r) => r.filter((x) => x.author.id !== m.author.id));
                        toast("Removed " + res.removed + " messages");
                      }
                    }}
                    className="rounded p-1.5 text-muted hover:text-red-300"
                    title="Remove all their messages"
                    aria-label={"Remove all messages from " + m.author.username}
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (await liveAction({ action: "delete", id: m.id })) setRecent((r) => r.filter((x) => x.id !== m.id));
                    }}
                    className="rounded p-1.5 text-muted hover:text-red-300"
                    title="Delete message"
                    aria-label="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Announcements({ initial, onChange }: { initial: Announcement[]; onChange: () => void }) {
  const [list, setList] = useState(initial);
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [tone, setTone] = useState<"info" | "important">("info");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>("24h");
  const [busy, setBusy] = useState(false);

  async function call(payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(json.error ?? "Something went wrong", "error");
      return false;
    }
    const fresh = await fetch("/api/admin/announcements", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (fresh?.announcements) setList(fresh.announcements);
    onChange();
    return true;
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    const ok = await call({ action: "create", body, href, tone, duration });
    setBusy(false);
    if (ok) {
      setBody("");
      setHref("");
      toast("Announcement is live");
    }
  }

  return (
    <section className="panel rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Megaphone className="h-4 w-4" /> Announcements
      </h2>
      <p className="mt-1 text-xs text-muted">Shows across the top of every page for everyone, even over a fullscreen episode, until it ends or they dismiss it. A new one replaces the current one.</p>

      <form onSubmit={post} className="mt-5 space-y-3">
        <div>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, MAX))} rows={2} placeholder="New episodes of… / Maintenance tonight at… / Join the watch party…" className="input resize-none text-sm" aria-label="Announcement text" />
          <div className="mt-1 text-right font-mono text-[10px] text-muted">{MAX - body.length}</div>
        </div>
        <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="Optional link: /watch-together or https://…" className="input text-sm" aria-label="Announcement link" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Style</span>
            <div className="flex rounded-lg bg-white/[0.04] p-0.5 text-xs">
              {(["info", "important"] as const).map((t) => (
                <button type="button" key={t} onClick={() => setTone(t)} className={`rounded-md px-2.5 py-1 capitalize transition-colors ${tone === t ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Runs for</span>
            <div className="flex flex-wrap gap-1">
              {DURATIONS.map((d) => (
                <button type="button" key={d} onClick={() => setDuration(d)} className={`rounded-md px-2 py-1 text-xs transition-colors ${duration === d ? "bg-accent/15 text-accent" : "bg-white/[0.04] text-muted hover:text-fg"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <button disabled={!body.trim() || busy} className="btn btn-primary ml-auto gap-2 !py-1.5 text-sm">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Post announcement
          </button>
        </div>
      </form>

      {list.length > 0 && (
        <ul className="mt-6 divide-y divide-white/[0.05] border-t border-white/[0.06]">
          {list.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.live ? "bg-success" : "bg-white/20"}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-fg/90">{a.body}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {a.live ? "Live" : "Ended"} · {a.tone} · by {a.author} · <TimeAgo iso={a.createdAt} />
                  {a.live && " · ends " + new Date(a.expiresAt).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  {a.href && " · " + a.href}
                </p>
              </div>
              {a.live && (
                <button onClick={() => void call({ action: "end", id: a.id })} className="btn btn-ghost shrink-0 !px-2.5 !py-1 text-xs">
                  End now
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
