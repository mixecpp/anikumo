"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, LoaderCircle, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "./UserMenu";
import SectionHeading from "./SectionHeading";
import SpoilerText from "./SpoilerText";
import ReportButton from "./ReportButton";
import RoleIcon from "./RoleIcon";
import type { Role } from "@/lib/roles";
import { toast } from "@/lib/toast";

type U = { id: string; username: string; avatarColor: string; avatar: string; profilePublic: boolean; role?: Role };
type C = { id: string; body: string; createdAt: string; editedAt: string | null; likeCount: number; liked: boolean; user: U; replies?: C[] };

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Composer({ onSubmit, placeholder, autoFocus, initial = "", onCancel, compact }: { onSubmit: (body: string) => Promise<boolean>; placeholder: string; autoFocus?: boolean; initial?: string; onCancel?: () => void; compact?: boolean }) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(!!autoFocus);
  const send = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    if (await onSubmit(body.trim())) setBody("");
    setBusy(false);
  };
  const expanded = focused || body || compact;
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className={`rounded-xl border bg-white/[0.02] transition-colors ${focused ? "border-white/20" : "border-white/[0.07]"}`}>
      <textarea
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
          if (e.key === "Escape" && onCancel) onCancel();
        }}
        placeholder={placeholder}
        rows={expanded ? 3 : 1}
        maxLength={2000}
        className="block w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted/70"
      />
      {expanded && (
        <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2">
          <span className="font-mono text-[11px] text-muted">||spoiler||<span className="keyboard-only"> · Ctrl+Enter</span></span>
          <div className="flex gap-1.5">
            {onCancel && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onCancel} className="btn btn-ghost !px-3 !py-1.5 !text-xs">Cancel</button>
            )}
            <button disabled={busy || !body.trim()} onMouseDown={(e) => e.preventDefault()} className="btn btn-primary !px-3 !py-1.5 !text-xs">
              {busy && <LoaderCircle className="spin h-3.5 w-3.5" />} {initial ? "Save" : "Post"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * `docked`: for the phone sheet — the list scrolls and the comment box stays pinned at the
 * bottom (like YouTube), so it sits just above the keyboard while you type.
 */
export default function Comments({ anilistId, episode, loggedIn, hideHeading = false, docked = false }: { anilistId: number; episode?: number; loggedIn: boolean; hideHeading?: boolean; docked?: boolean }) {
  const [comments, setComments] = useState<C[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [replying, setReplying] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const qs = `anilistId=${anilistId}${episode ? `&episode=${episode}` : ""}&sort=${sort}`;
  const load = useCallback(async () => {
    const json = await fetch(`/api/comments?${qs}`).then((r) => r.json()).catch(() => ({}));
    setComments(json.comments ?? []);
    setMe(json.me ?? null);
    setStaff(json.staff === true);
  }, [qs]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!comments || !location.hash.startsWith("#comment-")) return;
    document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [comments]);

  const total = comments?.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  async function post(body: string, parentId?: string) {
    const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anilistId, episode: episode ?? null, body, parentId: parentId ?? null }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(json.error ?? "Couldn't post", "error");
      return false;
    }
    if (parentId) {
      setComments((cs) => cs?.map((c) => (c.id === parentId || c.replies?.some((r) => r.id === parentId) ? { ...c, replies: [...(c.replies ?? []), json.comment] } : c)) ?? null);
      setReplying(null);
    } else setComments((cs) => [json.comment, ...(cs ?? [])]);
    return true;
  }

  async function edit(id: string, body: string) {
    const res = await fetch("/api/comments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, body }) });
    if (!res.ok) {
      toast("Couldn't save edit", "error");
      return false;
    }
    const upd = (c: C): C => (c.id === id ? { ...c, body, editedAt: new Date().toISOString() } : { ...c, replies: c.replies?.map(upd) });
    setComments((cs) => cs?.map(upd) ?? null);
    setEditing(null);
    return true;
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    if (!res.ok) return toast("Couldn't delete comment", "error");
    setComments((cs) => cs?.filter((c) => c.id !== id).map((c) => ({ ...c, replies: c.replies?.filter((r) => r.id !== id) })) ?? null);
  }

  async function like(c: C) {
    if (!loggedIn) return toast("Log in to like comments", "info");
    const flip = (x: C): C => (x.id === c.id ? { ...x, liked: !x.liked, likeCount: x.likeCount + (x.liked ? -1 : 1) } : { ...x, replies: x.replies?.map(flip) });
    setComments((cs) => cs?.map(flip) ?? null);
    const res = await fetch("/api/comments/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId: c.id }) });
    if (!res.ok) setComments((cs) => cs?.map(flip) ?? null);
  }

  function renderItem(c: C, threadId: string, isReply = false) {
    const mine = c.user.id === me;
    return (
      <div key={c.id} id={`comment-${c.id}`} className="group flex scroll-mt-28 gap-3">
        <Avatar name={c.user.username} color={c.user.avatarColor} avatar={c.user.avatar} size={isReply ? 26 : 32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            {c.user.profilePublic ? (
              <Link href={`/u/${c.user.username}`} className="font-medium hover:underline">{c.user.username}</Link>
            ) : (
              <span className="font-medium">{c.user.username}</span>
            )}
            <RoleIcon role={c.user.role} className="-ml-1" />
            <span className="font-mono text-[11px] text-muted">
              {ago(c.createdAt)}
              {c.editedAt ? " · edited" : ""}
            </span>
          </div>
          {editing === c.id ? (
            <div className="mt-2">
              <Composer initial={c.body} autoFocus compact placeholder="Edit comment" onSubmit={(b) => edit(c.id, b)} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <SpoilerText text={c.body} className="mt-1 text-sm leading-relaxed text-fg/85" />
          )}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
            <button onClick={() => like(c)} className={`flex items-center gap-1 transition-colors ${c.liked ? "text-accent" : "hover:text-fg"}`} aria-pressed={c.liked} aria-label="Like">
              <Heart className={`h-3.5 w-3.5 ${c.liked ? "fill-current" : ""}`} /> {c.likeCount || ""}
            </button>
            {loggedIn && (
              <button onClick={() => setReplying(replying === threadId ? null : threadId)} className="flex items-center gap-1 hover:text-fg">
                <MessageCircle className="h-3.5 w-3.5" /> Reply
              </button>
            )}
            <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              {mine ? (
                <>
                  <button onClick={() => setEditing(c.id)} className="rounded p-1 hover:text-fg" aria-label="Edit comment"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(c.id)} className="rounded p-1 hover:text-fg" aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              ) : (
                <>
                  {loggedIn && <ReportButton targetType="comment" targetId={c.id} />}
                  {staff && (
                    <button onClick={() => confirm(`Remove this comment by ${c.user.username}?`) && remove(c.id)} className="rounded p-1 text-red-300/80 hover:text-red-300" aria-label="Remove comment (moderator)" title="Remove (moderator)">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const composer = loggedIn ? (
    <Composer placeholder={episode ? "Thoughts on this episode? Wrap spoilers in ||double bars||." : "Add to the discussion…"} onSubmit={(b) => post(b)} />
  ) : (
    <p className="text-sm text-muted">
      <Link href="/login" className="text-fg underline-offset-4 hover:underline">Log in</Link> to join the discussion.
    </p>
  );

  return (
    <section className={docked ? "flex h-full min-h-0 flex-col" : ""}>
      <div className={docked ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4" : ""}>
      <div className="flex items-start justify-between gap-3">
        {hideHeading ? <div className="flex-1" /> : <SectionHeading title={episode ? `Episode ${episode} discussion` : "Discussion"} count={total} className="flex-1" />}
        <div className="flex rounded-lg bg-white/[0.05] p-0.5 text-xs">
          {(["new", "top"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`rounded-md px-2.5 py-1 capitalize transition-colors ${sort === s ? "bg-white/[0.1] text-fg" : "text-muted hover:text-fg"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {docked ? <div className="mb-5" /> : <div className="mb-8">{composer}</div>}

      {comments === null ? (
        <div className="space-y-5">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet.</p>
      ) : (
        <ul className="space-y-6">
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.li key={c.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                {renderItem(c, c.id)}
                {(c.replies?.length || replying === c.id) && (
                  <div className="ml-11 mt-4 space-y-4 border-l border-white/[0.06] pl-4">
                    {c.replies?.map((r) => renderItem(r, c.id, true))}
                    {replying === c.id && <Composer autoFocus compact placeholder={`Reply to ${c.user.username}`} onSubmit={(b) => post(b, c.id)} onCancel={() => setReplying(null)} />}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      </div>
      {docked && <div className="shrink-0 border-t border-white/[0.06] bg-bg px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">{composer}</div>}
    </section>
  );
}
