"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast, undoable } from "@/lib/toast";
import { Toggle } from "../list/EntryEditor";
import ConfirmButton from "../account/ConfirmButton";

type Item = { anilistId: number; title: string; coverImage: string; note: string };

async function post(body: object) {
  const res = await fetch("/api/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Couldn't save", "error");
  return res.ok;
}

export default function ListEditor({ list, items: initial, shareUrl, profilePublic }: { list: { id: string; title: string; description: string; isPublic: boolean }; items: Item[]; shareUrl: string; profilePublic: boolean }) {
  const router = useRouter();
  const [meta, setMeta] = useState(list);
  const [items, setItems] = useState(initial);
  const dirty = meta.title !== list.title || meta.description !== list.description;

  async function saveMeta() {
    if (await post({ action: "update", listId: list.id, title: meta.title, description: meta.description })) {
      toast("List saved");
      router.refresh();
    }
  }

  async function setPublic(v: boolean) {
    setMeta((m) => ({ ...m, isPublic: v }));
    if (!(await post({ action: "update", listId: list.id, isPublic: v }))) setMeta((m) => ({ ...m, isPublic: !v }));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    post({ action: "reorder", listId: list.id, order: next.map((x) => x.anilistId) });
  }

  function remove(item: Item) {
    const prev = items;
    setItems((list) => list.filter((x) => x.anilistId !== item.anilistId));
    undoable(`Removed ${item.title}`, {
      commit: () => post({ action: "toggle", listId: list.id, anilistId: item.anilistId }),
      revert: () => setItems(prev),
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + shareUrl);
      toast("Link copied");
    } catch {
      toast("Couldn't copy", "error");
    }
  }

  return (
    <div>
      <Link href="/account/lists" className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All lists
      </Link>
      <div className="panel space-y-4 rounded-2xl p-5">
        <input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} maxLength={80} className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="List title" />
        <textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} maxLength={500} rows={2} placeholder="Add a description…" className="input resize-none text-sm" aria-label="Description" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Toggle on={meta.isPublic} onChange={setPublic} label="Public list" /> Public
          </label>
          {meta.isPublic && profilePublic && (
            <>
              <button onClick={copyLink} className="btn btn-ghost !py-1.5 !text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy link
              </button>
              <Link href={shareUrl} className="btn btn-ghost !py-1.5 !text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> View
              </Link>
            </>
          )}
          {meta.isPublic && !profilePublic && (
            <Link href="/account/settings?tab=privacy" className="text-xs text-muted hover:text-fg">
              Make your profile public to share this list
            </Link>
          )}
          <div className="ml-auto flex gap-2">
            {dirty && (
              <button onClick={saveMeta} className="btn btn-primary !py-1.5">
                Save
              </button>
            )}
            <ConfirmButton
              label="Delete list"
              confirmLabel="Delete for good?"
              onConfirm={async () => {
                if (await post({ action: "delete", listId: list.id })) {
                  toast("List deleted", "info");
                  router.push("/account/lists");
                }
              }}
            />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          Empty list. Use the <span className="text-fg">list button</span> on any anime page to add shows.
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          <AnimatePresence initial={false}>
            {items.map((it, i) => (
              <motion.li key={it.anilistId} layout exit={{ opacity: 0, height: 0 }} className="panel group flex items-start gap-3 rounded-xl p-2.5">
                <span className="w-6 pt-1 text-right font-mono text-xs text-muted">{i + 1}</span>
                <Link href={`/anime/${it.anilistId}`} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.coverImage} alt="" className="h-16 w-11 rounded object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/anime/${it.anilistId}`} className="block truncate text-sm hover:underline">
                    {it.title}
                  </Link>
                  <input
                    defaultValue={it.note}
                    onBlur={(e) => e.target.value !== it.note && post({ action: "note", listId: list.id, anilistId: it.anilistId, note: e.target.value }).then((ok) => ok && setItems((l) => l.map((x) => (x.anilistId === it.anilistId ? { ...x, note: e.target.value } : x))))}
                    maxLength={300}
                    placeholder="Add a note…"
                    className="mt-1 w-full bg-transparent text-xs text-muted outline-none placeholder:text-muted/50 focus:text-fg"
                    aria-label={`Note for ${it.title}`}
                  />
                </div>
                <div className="flex gap-0.5 opacity-60 transition group-hover:opacity-100">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded p-1.5 text-muted hover:text-fg disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(it)} className="rounded p-1.5 text-muted hover:text-fg" aria-label={`Remove ${it.title}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
