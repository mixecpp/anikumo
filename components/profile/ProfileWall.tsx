"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Role } from "@/lib/roles";
import { Avatar } from "../UserMenu";
import SpoilerText from "../SpoilerText";
import ReportButton from "../ReportButton";
import RoleIcon from "../RoleIcon";
import { ago } from "../posts/Posts";

const MAX = 300;

type Person = { username: string; avatarColor: string; avatar: string; role: Role };
type WallComment = { id: string; body: string; createdAt: string; author: Person; mine: boolean; canDelete: boolean; staffRemove: boolean };
type Data = { comments: WallComment[]; next: string | null; canPost: boolean; off?: boolean; followersOnly?: boolean };

async function wallAction(body: object) {
  const res = await fetch("/api/profile-comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Something went wrong", "error");
  return res.ok ? json : null;
}

/**
 * Comments people leave on a profile. The profile's owner can delete any of them; who can
 * write here is their choice (everyone, followers or nobody) in privacy settings.
 */
export default function ProfileWall({ username, isOwner, loggedIn }: { username: string; isOwner: boolean; loggedIn: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      const res = await fetch(`/api/profile-comments?username=${encodeURIComponent(username)}${before ? `&before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store" });
      if (!res.ok) return setData((d) => d ?? { comments: [], next: null, canPost: false });
      const json: Data = await res.json();
      setData((d) => (before && d ? { ...json, comments: [...d.comments, ...json.comments] } : json));
    },
    [username],
  );
  useEffect(() => {
    load();
  }, [load]);

  // Linked from a notification: scroll the comment into view once it's loaded.
  useEffect(() => {
    if (!data || !location.hash.startsWith("#wall-")) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    const json = await wallAction({ action: "create", username, body });
    setBusy(false);
    if (!json?.comment) return;
    setData((d) => d && { ...d, comments: [json.comment, ...d.comments] });
    setBody("");
  }

  async function remove(c: WallComment) {
    const ask = c.mine ? "Delete your comment?" : c.staffRemove ? `Remove this comment by ${c.author.username}? They'll be told it was removed.` : `Delete ${c.author.username}'s comment from your profile?`;
    if (!confirm(ask)) return;
    if (await wallAction({ action: "delete", id: c.id })) setData((d) => d && { ...d, comments: d.comments.filter((x) => x.id !== c.id) });
  }

  if (data?.off && !isOwner) return null;

  return (
    <section id="wall" className="scroll-mt-24">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-muted" /> Profile comments
          {data && data.comments.length > 0 && <span className="font-mono text-[11px] text-muted">{data.comments.length}{data.next ? "+" : ""}</span>}
        </h2>
        {isOwner && (
          <Link href="/account/settings?tab=privacy" className="text-xs text-muted hover:text-fg">
            {data?.off ? "Turned off · change" : data?.followersOnly ? "Followers only · change" : "Who can comment"}
          </Link>
        )}
      </div>

      {data?.off ? (
        <p className="panel rounded-xl p-4 text-sm text-muted">Comments on your profile are turned off.</p>
      ) : (
        <div className="panel rounded-xl p-3 sm:p-4">
          {data?.canPost ? (
            <form onSubmit={send} className="mb-4">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX))}
                onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && send(e)}
                rows={body ? 3 : 2}
                placeholder={isOwner ? "Leave a note for your visitors…" : `Say something nice to ${username}…`}
                className="input block w-full resize-none text-sm"
                aria-label="Write a profile comment"
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                {body.length > MAX - 60 && <span className="font-mono text-[11px] text-muted">{MAX - body.length}</span>}
                <button disabled={busy || !body.trim()} className="btn btn-primary !px-4 !py-1.5 !text-xs">
                  {busy && <LoaderCircle className="spin h-3.5 w-3.5" />} Comment
                </button>
              </div>
            </form>
          ) : data && !loggedIn ? (
            <p className="mb-4 text-xs text-muted">
              <Link href={`/login?next=/u/${username}`} className="text-fg underline-offset-2 hover:underline">
                Log in
              </Link>{" "}
              to comment.
            </p>
          ) : data?.followersOnly && !isOwner ? (
            <p className="mb-4 text-xs text-muted">Only people who follow {username} can comment.</p>
          ) : null}

          {data === null ? (
            <div className="grid h-16 place-items-center">
              <LoaderCircle className="spin h-4 w-4 text-muted" />
            </div>
          ) : data.comments.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">{isOwner ? "No comments on your profile yet." : "No comments yet — be the first."}</p>
          ) : (
            <ul className="space-y-4">
              <AnimatePresence initial={false}>
                {data.comments.map((c) => (
                  <motion.li
                    key={c.id}
                    id={`wall-${c.id}`}
                    layout="position"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group/w flex scroll-mt-28 gap-2.5"
                  >
                    <Link href={`/u/${c.author.username}`} className="shrink-0">
                      <Avatar name={c.author.username} color={c.author.avatarColor} avatar={c.author.avatar} size={30} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[13px]">
                        <Link href={`/u/${c.author.username}`} className="truncate font-medium hover:underline">
                          {c.author.username}
                        </Link>
                        <RoleIcon role={c.author.role} />
                        <span className="font-mono text-[10px] text-muted" suppressHydrationWarning>
                          {ago(c.createdAt)}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                          {!c.mine && loggedIn && <ReportButton targetType="profile_comment" targetId={c.id} className="opacity-0 transition group-hover/w:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100" />}
                          {c.canDelete && (
                            <button
                              onClick={() => remove(c)}
                              className={`rounded p-1 opacity-0 transition group-hover/w:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 ${c.staffRemove ? "text-red-300/80 hover:text-red-300" : "text-muted hover:text-fg"}`}
                              aria-label={c.mine ? "Delete your comment" : "Delete comment"}
                              title={c.mine ? "Delete" : c.staffRemove ? "Remove (moderator)" : "Delete from your profile"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </div>
                      <SpoilerText text={c.body} className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/85" />
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          {data?.next && (
            <div className="mt-4 text-center">
              <button
                onClick={async () => {
                  setLoadingMore(true);
                  await load(data.next!);
                  setLoadingMore(false);
                }}
                disabled={loadingMore}
                className="btn btn-ghost !py-1.5 !text-xs"
              >
                {loadingMore && <LoaderCircle className="spin h-3.5 w-3.5" />} Older comments
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
