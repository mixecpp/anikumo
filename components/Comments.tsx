"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "./UserMenu";

type C = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; username: string; avatarColor: string };
};

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Comments({ anilistId, episode, loggedIn }: { anilistId: number; episode?: number; loggedIn: boolean }) {
  const [comments, setComments] = useState<C[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const qs = `anilistId=${anilistId}${episode ? `&episode=${episode}` : ""}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?${qs}`);
    const json = await res.json();
    setComments(json.comments ?? []);
    setMe(json.me ?? null);
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilistId, episode: episode ?? null, body }),
    });
    const json = await res.json();
    if (res.ok) {
      setComments((c) => [json.comment, ...(c ?? [])]);
      setBody("");
    } else setError(json.error);
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    if (res.ok) setComments((c) => c?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <section>
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold">
        {episode ? `Episode ${episode} discussion` : "Discussion"}
        {comments && <span className="ml-2 text-base font-normal text-muted">{comments.length}</span>}
      </h2>

      {loggedIn ? (
        <form onSubmit={post} className="mb-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={episode ? "Thoughts on this episode? (mark spoilers!)" : "Share your thoughts…"}
            rows={3}
            maxLength={2000}
            className="input resize-none text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-accent">{error}</span>
            <button disabled={busy || !body.trim()} className="btn btn-primary !py-2">
              Post
            </button>
          </div>
        </form>
      ) : (
        <p className="mb-6 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      {comments === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet. Be the first!</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="fade-in flex gap-3">
              <Avatar name={c.user.username} color={c.user.avatarColor} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{c.user.username}</span>
                  <span className="text-xs text-muted">{ago(c.createdAt)}</span>
                  {c.user.id === me && (
                    <button onClick={() => remove(c.id)} className="ml-auto text-xs text-muted hover:text-accent">
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg/90">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
