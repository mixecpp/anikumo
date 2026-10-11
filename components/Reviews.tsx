"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle, Pencil, Star, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Avatar } from "./UserMenu";
import SectionHeading from "./SectionHeading";
import SpoilerText from "./SpoilerText";
import ReportButton from "./ReportButton";
import ScorePicker from "./list/ScorePicker";
import { usePrefs } from "./PrefsProvider";

type R = { id: string; score: number; title: string; body: string; createdAt: string; helpful: number; voted: boolean; user: { id: string; username: string; avatarColor: string; avatar: string; profilePublic: boolean } };

export default function Reviews({ anilistId }: { anilistId: number }) {
  const { loggedIn } = usePrefs();
  const [data, setData] = useState<{ reviews: R[]; me: string | null; average: number | null } | null>(null);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ score: null as number | null, title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(() => fetch(`/api/reviews?anilistId=${anilistId}`).then((r) => r.json()).then(setData).catch(() => setData({ reviews: [], me: null, average: null })), [anilistId]);
  useEffect(() => {
    load();
  }, [load]);

  const mine = data?.reviews.find((r) => r.user.id === data.me);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.score) return toast("Pick a score", "info");
    setBusy(true);
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anilistId, ...form }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(json.error ?? "Couldn't post review", "error");
    toast(mine ? "Review updated" : "Review posted");
    setWriting(false);
    load();
  }

  async function vote(r: R) {
    if (!loggedIn) return toast("Log in to vote", "info");
    setData((d) => d && { ...d, reviews: d.reviews.map((x) => (x.id === r.id ? { ...x, voted: !x.voted, helpful: x.helpful + (x.voted ? -1 : 1) } : x)) });
    const res = await fetch("/api/reviews/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId: r.id }) });
    if (!res.ok) load();
  }

  async function remove() {
    await fetch(`/api/reviews?anilistId=${anilistId}`, { method: "DELETE" });
    toast("Review deleted", "info");
    load();
  }

  return (
    <section>
      <SectionHeading title="Reviews" count={data?.reviews.length} />
      {data?.average != null && data.reviews.length > 0 && (
        <p className="-mt-2 mb-4 flex items-center gap-1 text-sm text-muted">
          <Star className="h-3.5 w-3.5 fill-star text-star" /> {data.average.toFixed(1)} average from AniKumo reviewers
        </p>
      )}

      {loggedIn && !writing && (
        <button
          onClick={() => {
            setForm(mine ? { score: mine.score, title: mine.title, body: mine.body } : { score: null, title: "", body: "" });
            setWriting(true);
          }}
          className="btn btn-ghost mb-6"
        >
          <Pencil className="h-4 w-4" /> {mine ? "Edit your review" : "Write a review"}
        </button>
      )}
      {!loggedIn && (
        <p className="mb-6 text-sm text-muted">
          <Link href="/login" className="text-fg hover:underline">Log in</Link> to write a review.
        </p>
      )}

      <AnimatePresence>
        {writing && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onSubmit={submit} className="mb-8 overflow-hidden">
            <div className="panel space-y-4 rounded-2xl p-4">
              <ScorePicker value={form.score} onChange={(score) => setForm({ ...form, score })} />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} placeholder="Headline (optional)" className="input text-sm" aria-label="Review headline" />
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} maxLength={3000} placeholder="What worked, what didn't? Wrap spoilers in ||double bars||." className="input resize-y text-sm" aria-label="Review" />
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-muted">{form.body.length}/3000 · min 20</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setWriting(false)} className="btn btn-ghost">Cancel</button>
                  <button disabled={busy || form.body.trim().length < 20} className="btn btn-primary">
                    {busy && <LoaderCircle className="spin h-4 w-4" />} {mine ? "Update" : "Post review"}
                  </button>
                </div>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {data === null ? (
        <div className="skeleton h-24 rounded-2xl" />
      ) : data.reviews.length === 0 ? (
        <p className="text-sm text-muted">No reviews yet.</p>
      ) : (
        <ul className="space-y-4">
          {data.reviews.map((r) => {
            const long = r.body.length > 420;
            const open = expanded.has(r.id);
            return (
              <li key={r.id} className="panel rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.user.username} color={r.user.avatarColor} avatar={r.user.avatar} size={30} />
                  <div className="min-w-0 flex-1">
                    {r.user.profilePublic ? (
                      <Link href={`/u/${r.user.username}`} className="text-sm font-medium hover:underline">{r.user.username}</Link>
                    ) : (
                      <span className="text-sm font-medium">{r.user.username}</span>
                    )}
                    <div className="font-mono text-[11px] text-muted">{new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
                  </div>
                  <span className="flex items-center gap-1 font-mono text-sm">
                    <Star className="h-3.5 w-3.5 fill-star text-star" /> {r.score}/10
                  </span>
                </div>
                {r.title && <h3 className="mt-3 text-sm font-semibold">{r.title}</h3>}
                <div className={`relative mt-1.5 ${long && !open ? "max-h-28 overflow-hidden" : ""}`}>
                  <SpoilerText text={r.body} className="text-sm leading-relaxed text-fg/85" />
                  {long && !open && <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-panel" />}
                </div>
                {long && (
                  <button onClick={() => setExpanded((s) => new Set(s).add(r.id))} className={`mt-1 text-xs text-muted hover:text-fg ${open ? "hidden" : ""}`}>
                    Read more
                  </button>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  {r.user.id !== data.me ? (
                    <>
                      <button onClick={() => vote(r)} className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${r.voted ? "bg-accent/15 text-accent" : "hover:bg-white/[0.06] hover:text-fg"}`}>
                        <ThumbsUp className="h-3.5 w-3.5" /> Helpful{r.helpful ? ` · ${r.helpful}` : ""}
                      </button>
                      {loggedIn && <ReportButton targetType="review" targetId={r.id} />}
                    </>
                  ) : (
                    <>
                      <span>{r.helpful} found this helpful</span>
                      <button onClick={remove} className="ml-auto flex items-center gap-1 hover:text-fg">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
