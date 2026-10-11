"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, LoaderCircle, Minus, Pin, Plus, Repeat, X } from "lucide-react";
import { LIST_STATUSES, STATUS_DOT, STATUS_LABEL, type ListEntryDTO, type ListStatus } from "@/lib/list-shared";
import ScorePicker from "./ScorePicker";

type Draft = Pick<ListEntryDTO, "status" | "score" | "progress" | "notes" | "tags" | "pinned" | "hiddenFromContinue" | "rewatching" | "rewatchEpisode">;

/** Full editor for one list entry, shown as a dialog. */
export default function EntryEditor({
  open,
  onClose,
  entry,
  title,
  coverImage,
  total,
  onSave,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  entry: ListEntryDTO | null;
  title: string;
  coverImage: string;
  total: number | null;
  onSave: (patch: Partial<ListEntryDTO>) => Promise<unknown>;
  onRemove?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraft({
      status: entry?.status ?? "PLANNING",
      score: entry?.score ?? null,
      progress: entry?.progress ?? 0,
      notes: entry?.notes ?? "",
      tags: entry?.tags ?? [],
      pinned: entry?.pinned ?? false,
      hiddenFromContinue: entry?.hiddenFromContinue ?? false,
      rewatching: entry?.rewatching ?? false,
      rewatchEpisode: entry?.rewatchEpisode ?? 0,
    });
    setTagInput("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, entry, onClose]);

  if (!mounted) return null;
  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const max = total ?? 100000;

  function addTag() {
    const t = tagInput.trim().toLowerCase().slice(0, 24);
    if (t && draft && !draft.tags.includes(t) && draft.tags.length < 12) set({ tags: [...draft.tags, t] });
    setTagInput("");
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const patch: Partial<ListEntryDTO> = { ...draft };
    if (draft.status === "COMPLETED" && total && draft.progress < total) patch.progress = total;
    await onSave(patch);
    setSaving(false);
    onClose();
  }

  return createPortal(
    <AnimatePresence>
      {open && draft && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-[75] grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
          <motion.div
            role="dialog"
            aria-label={`Edit ${title}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong thin-scroll max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {coverImage && <img src={coverImage} alt="" className="h-14 w-10 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="label">Edit list entry</div>
                <div className="truncate text-sm font-medium">{title}</div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div>
                <div className="label mb-2">Status</div>
                <div className="flex flex-wrap gap-1.5">
                  {LIST_STATUSES.map((s: ListStatus) => (
                    <button
                      key={s}
                      onClick={() => set({ status: s, ...(s === "COMPLETED" && total ? { progress: total } : {}) })}
                      aria-pressed={draft.status === s}
                      className={`press flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${draft.status === s ? "bg-fg text-bg" : "bg-white/[0.06] text-fg/80 hover:bg-white/[0.1]"}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`} />
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="label mb-2">Your score</div>
                  <ScorePicker value={draft.score} onChange={(score) => set({ score })} />
                </div>
                <div>
                  <div className="label mb-2">Episodes watched</div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => set({ progress: Math.max(0, draft.progress - 1) })} className="btn btn-ghost btn-icon !h-8 !w-8" aria-label="One less episode">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={max}
                      value={draft.progress}
                      onChange={(e) => set({ progress: Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
                      className="input !w-20 !py-1.5 text-center font-mono text-sm"
                      aria-label="Episodes watched"
                    />
                    <button onClick={() => set({ progress: Math.min(max, draft.progress + 1) })} className="btn btn-ghost btn-icon !h-8 !w-8" aria-label="One more episode">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-mono text-xs text-muted">/ {total ?? "?"}</span>
                  </div>
                </div>
              </div>

              {draft.status === "COMPLETED" && (
                <div className="rounded-xl bg-white/[0.03] p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm">
                      <Repeat className="h-4 w-4 text-muted" /> Rewatching
                      {entry?.rewatchCount ? <span className="font-mono text-[11px] text-muted">· watched {entry.rewatchCount + 1}×</span> : null}
                    </span>
                    <Toggle on={draft.rewatching} onChange={(v) => set({ rewatching: v, rewatchEpisode: v ? draft.rewatchEpisode : 0 })} label="Rewatching" />
                  </label>
                  {draft.rewatching && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                      Rewatch episode
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={draft.rewatchEpisode}
                        onChange={(e) => set({ rewatchEpisode: Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
                        className="input !w-20 !py-1 text-center font-mono text-sm"
                        aria-label="Rewatch episode"
                      />
                      <span className="font-mono text-xs">/ {total ?? "?"}</span>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted">Your original completion stays. Finishing the last episode adds one to your rewatch count.</p>
                </div>
              )}

              <div>
                <div className="label mb-2">Tags</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {draft.tags.map((t) => (
                    <button key={t} onClick={() => set({ tags: draft.tags.filter((x) => x !== t) })} className="press group flex items-center gap-1 rounded-full bg-white/[0.07] py-1 pl-3 pr-2 text-xs hover:bg-white/[0.12]">
                      {t}
                      <X className="h-3 w-3 text-muted group-hover:text-fg" />
                    </button>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    placeholder={draft.tags.length ? "Add tag" : "e.g. comfort, with friends"}
                    className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-xs outline-none placeholder:text-muted"
                    aria-label="Add tag"
                  />
                </div>
              </div>

              <div>
                <div className="label mb-2">Private notes</div>
                <textarea
                  value={draft.notes}
                  onChange={(e) => set({ notes: e.target.value.slice(0, 2000) })}
                  rows={3}
                  placeholder="Only you can see these — e.g. “stopped at the time skip”, “watch S2 first”"
                  className="input resize-none text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Pin className="h-4 w-4 text-muted" /> Pin to Continue Watching
                  </span>
                  <Toggle on={draft.pinned} onChange={(v) => set({ pinned: v, hiddenFromContinue: v ? false : draft.hiddenFromContinue })} label="Pin" />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    {draft.hiddenFromContinue ? <EyeOff className="h-4 w-4 text-muted" /> : <Eye className="h-4 w-4 text-muted" />} Hide from Continue Watching
                  </span>
                  <Toggle on={draft.hiddenFromContinue} onChange={(v) => set({ hiddenFromContinue: v, pinned: v ? false : draft.pinned })} label="Hide" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] p-4">
              {entry && onRemove ? (
                <button
                  onClick={() => {
                    onRemove();
                    onClose();
                  }}
                  className="text-sm text-red-300 hover:underline"
                >
                  Remove from list
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button onClick={onClose} className="btn btn-ghost">
                  Cancel
                </button>
                <button onClick={save} disabled={saving} className="btn btn-primary min-w-20">
                  {saving && <LoaderCircle className="spin h-4 w-4" />} Save
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onChange(!on);
      }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-white/15"}`}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#fff] shadow ${on ? "right-0.5" : "left-0.5"}`} />
    </button>
  );
}
