"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, LoaderCircle, MessageCircle, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import type { PostView } from "@/lib/posts";
import { Avatar } from "../UserMenu";
import SpoilerText from "../SpoilerText";
import { usePrefs } from "../PrefsProvider";
import ReportButton from "../ReportButton";

const POST_MAX = 500;
const COMMENT_MAX = 300;

type Comment = { id: string; body: string; createdAt: string; author: { username: string; avatarColor: string; avatar: string }; mine: boolean; canDelete: boolean };
type Source = { username: string } | { feed: "following" | "everyone" };

async function postAction(body: object) {
  const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Something went wrong", "error");
  return res.ok ? json : null;
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** A list of posts (someone's profile, or a feed) with the composer on top when you can post. */
export default function PostFeed({ source, canPost, empty }: { source: Source; canPost: boolean; empty: string }) {
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState(false);
  const qs = "username" in source ? `username=${encodeURIComponent(source.username)}` : `feed=${source.feed}`;

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      const res = await fetch(`/api/posts?${qs}${before ? `&before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store" });
      const json = res.ok ? await res.json() : { posts: [], next: null };
      setPosts((p) => (before && p ? [...p, ...json.posts] : json.posts));
      setNext(json.next);
      setStaff(json.staff === true);
      setLoading(false);
    },
    [qs],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      {canPost && <PostComposer onPosted={(p) => setPosts((ps) => [p, ...(ps ?? [])])} />}
      {posts === null ? (
        <div className="grid h-32 place-items-center">
          <LoaderCircle className="spin h-5 w-5 text-muted" />
        </div>
      ) : posts.length === 0 ? (
        <p className="panel rounded-xl p-8 text-center text-sm text-muted">{empty}</p>
      ) : (
        <AnimatePresence initial={false}>
          {posts.map((p) => (
            <motion.div key={p.id} layout="position" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
              <PostCard post={p} staff={staff} onDeleted={() => setPosts((ps) => ps?.filter((x) => x.id !== p.id) ?? null)} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
      {next && (
        <div className="pt-2 text-center">
          <button onClick={() => load(next)} disabled={loading} className="btn btn-ghost">
            {loading && <LoaderCircle className="spin h-4 w-4" />} Load more
          </button>
        </div>
      )}
    </div>
  );
}

type Anime = { id: number; title: string; cover: string };

export function PostComposer({ onPosted }: { onPosted: (p: PostView) => void }) {
  const [body, setBody] = useState("");
  const [anime, setAnime] = useState<Anime | null>(null);
  const [recommend, setRecommend] = useState(true);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || (!body.trim() && !anime)) return;
    setBusy(true);
    const json = await postAction({ action: "create", body, anilistId: anime?.id, recommend });
    setBusy(false);
    if (!json?.post) return;
    onPosted(json.post);
    setBody("");
    setAnime(null);
    setPicking(false);
  }

  return (
    <form onSubmit={submit} className="panel rounded-xl p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, POST_MAX))}
        onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit(e)}
        rows={body ? 3 : 2}
        placeholder={anime ? `Why should people watch ${anime.title}?` : "What are you watching? Recommend something…"}
        className="block w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted/70"
        aria-label="Write a post"
      />
      {anime && (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={anime.cover} alt="" className="h-12 w-8 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{anime.title}</div>
            <label className="mt-0.5 flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={recommend} onChange={(e) => setRecommend(e.target.checked)} className="accent-[var(--accent)]" />
              Recommend it
            </label>
          </div>
          <button type="button" onClick={() => setAnime(null)} className="rounded p-1 text-muted hover:text-fg" aria-label="Remove anime">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {picking && !anime && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <AnimeSearch
              onPick={(a) => {
                setAnime(a);
                setPicking(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-2 flex items-center gap-2 border-t border-white/[0.06] pt-2">
        {!anime && (
          <button type="button" onClick={() => setPicking((p) => !p)} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${picking ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg"}`}>
            <Plus className="h-3.5 w-3.5" /> Anime
          </button>
        )}
        <span className={`ml-auto font-mono text-[11px] ${body.length > POST_MAX - 40 ? "text-amber-300" : "text-muted"}`}>{body.length ? POST_MAX - body.length : ""}</span>
        <button disabled={busy || (!body.trim() && !anime)} className="btn btn-primary !px-4 !py-1.5 !text-xs">
          {busy && <LoaderCircle className="spin h-3.5 w-3.5" />} Post
        </button>
      </div>
    </form>
  );
}

function AnimeSearch({ onPick }: { onPick: (a: Anime) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setItems((j.results ?? []).map((r: { id: number; title: string; cover: string }) => ({ id: r.id, title: r.title, cover: r.cover }))))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);
  return (
    <div className="mt-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an anime" className="input !py-2 !pl-9 text-sm" aria-label="Search an anime to attach" />
        {loading && <LoaderCircle className="spin absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
      </div>
      {items.length > 0 && (
        <ul className="mt-1.5 max-h-56 overflow-y-auto overscroll-contain">
          {items.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => onPick(a)} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-white/[0.05]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt="" className="h-10 w-7 rounded object-cover" />
                <span className="truncate text-sm">{a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PostCard({ post: initial, staff = false, onDeleted }: { post: PostView; staff?: boolean; onDeleted: () => void }) {
  const { loggedIn } = usePrefs();
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Linked straight to this post (e.g. from a notification): open its comments and scroll to it.
  useEffect(() => {
    if (location.hash === `#post-${post.id}`) {
      setOpen(true);
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  }, [post.id]);

  async function like() {
    if (!loggedIn) return toast("Log in to like posts", "info");
    setPost((p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));
    const json = await postAction({ action: "like", id: post.id });
    if (json) setPost((p) => ({ ...p, liked: json.liked, likes: json.likes }));
    else setPost((p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));
  }

  async function remove() {
    if (!confirm(post.mine ? "Delete this post?" : `Remove this post by ${post.author.username}?`)) return;
    if (await postAction({ action: "delete", id: post.id })) onDeleted();
  }

  return (
    <article ref={ref} id={`post-${post.id}`} className="panel group scroll-mt-24 rounded-xl p-4">
      <header className="flex items-center gap-2.5">
        <Link href={`/u/${post.author.username}`} className="shrink-0">
          <Avatar name={post.author.username} color={post.author.avatarColor} avatar={post.author.avatar} size={34} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${post.author.username}`} className="text-sm font-medium hover:underline">
            {post.author.username}
          </Link>
          <div className="font-mono text-[11px] text-muted" suppressHydrationWarning>
            {ago(post.createdAt)}
            {post.anime?.recommend && " · recommends"}
          </div>
        </div>
        {!post.mine && loggedIn && <ReportButton targetType="post" targetId={post.id} className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100" />}
        {(post.mine || staff) && (
          <button
            onClick={remove}
            className={`rounded-lg p-1.5 opacity-0 transition hover:bg-white/[0.06] group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 ${post.mine ? "text-muted hover:text-fg" : "text-red-300/80 hover:text-red-300"}`}
            aria-label={post.mine ? "Delete post" : "Remove post (moderator)"}
            title={post.mine ? "Delete" : "Remove (moderator)"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {post.body && <SpoilerText text={post.body} className="mt-2.5 text-sm leading-relaxed text-fg/90" />}

      {post.anime && (
        <Link href={`/anime/${post.anime.id}`} className="mt-3 flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 transition-colors hover:border-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.anime.cover} alt="" className="h-16 w-11 rounded object-cover" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{post.anime.title}</div>
            {post.anime.recommend && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                <Sparkles className="h-3 w-3" /> Recommended
              </span>
            )}
          </div>
        </Link>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
        <button onClick={like} className={`flex items-center gap-1.5 transition-colors ${post.liked ? "text-accent" : "hover:text-fg"}`} aria-pressed={post.liked} aria-label="Like">
          <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} /> {post.likes || ""}
        </button>
        <button onClick={() => setOpen((o) => !o)} className={`flex items-center gap-1.5 transition-colors ${open ? "text-fg" : "hover:text-fg"}`} aria-expanded={open}>
          <MessageCircle className="h-4 w-4" /> {post.comments || ""} <span className="sr-only">comments</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <Thread postId={post.id} loggedIn={loggedIn} onCount={(n) => setPost((p) => ({ ...p, comments: n }))} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function Thread({ postId, loggedIn, onCount }: { postId: string; loggedIn: boolean; onCount: (n: number) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/posts?id=${postId}`)
      .then((r) => r.json())
      .then((j) => setComments(j.comments ?? []))
      .catch(() => setComments([]));
  }, [postId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    const json = await postAction({ action: "comment", id: postId, body });
    setBusy(false);
    if (!json?.comment) return;
    const next = [...(comments ?? []), json.comment];
    setComments(next);
    onCount(next.length);
    setBody("");
  }

  async function remove(id: string) {
    if (!(await postAction({ action: "deleteComment", id }))) return;
    const next = (comments ?? []).filter((c) => c.id !== id);
    setComments(next);
    onCount(next.length);
  }

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      {comments === null ? (
        <LoaderCircle className="spin mx-auto h-4 w-4 text-muted" />
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="group/c flex gap-2.5">
              <Link href={`/u/${c.author.username}`} className="shrink-0">
                <Avatar name={c.author.username} color={c.author.avatarColor} avatar={c.author.avatar} size={26} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-[13px]">
                  <Link href={`/u/${c.author.username}`} className="font-medium hover:underline">
                    {c.author.username}
                  </Link>
                  <span className="font-mono text-[10px] text-muted" suppressHydrationWarning>
                    {ago(c.createdAt)}
                  </span>
                  {!c.mine && loggedIn && <ReportButton targetType="post_comment" targetId={c.id} className="ml-auto" />}
                  {c.canDelete && (
                    <button onClick={() => remove(c.id)} className={`${!c.mine && loggedIn ? "" : "ml-auto"} text-muted opacity-0 transition hover:text-fg group-hover/c:opacity-100 [@media(hover:none)]:opacity-100`} aria-label="Delete comment">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <SpoilerText text={c.body} className="text-sm leading-relaxed text-fg/85" />
              </div>
            </li>
          ))}
          {comments.length === 0 && <li className="text-xs text-muted">No comments yet.</li>}
        </ul>
      )}
      {loggedIn ? (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input value={body} onChange={(e) => setBody(e.target.value.slice(0, COMMENT_MAX))} placeholder="Write a comment…" className="input !py-2 text-sm" aria-label="Write a comment" />
          <button disabled={busy || !body.trim()} className="btn btn-ghost shrink-0 !py-1.5 !text-xs">
            {busy ? <LoaderCircle className="spin h-3.5 w-3.5" /> : "Reply"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted">
          <Link href="/login" className="text-fg underline-offset-2 hover:underline">
            Log in
          </Link>{" "}
          to comment.
        </p>
      )}
    </div>
  );
}
