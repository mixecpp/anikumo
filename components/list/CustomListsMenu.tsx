"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ListPlus, LoaderCircle, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { FloatingPortal, useDismiss, useFloating } from "../ui/Floating";

type L = { id: string; title: string; count: number; contains: boolean };

/** Add/remove the current show from your custom lists, or start a new list. */
export default function CustomListsMenu({ anilistId, title, coverImage }: { anilistId: number; title: string; coverImage: string }) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<L[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const floating = useFloating(ref, open, { align: "right", height: 320, width: 256 });
  useDismiss(open, () => setOpen(false), [ref, menu]);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/lists?anilistId=${anilistId}`)
      .then((r) => r.json())
      .then((j) => setLists(j.lists ?? []))
      .catch(() => setLists([]));
  }, [open, anilistId]);

  async function post(body: object) {
    const res = await fetch("/api/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) toast(json.error ?? "Couldn't update list", "error");
    return res.ok ? json : null;
  }

  async function toggle(l: L) {
    setLists((ls) => ls?.map((x) => (x.id === l.id ? { ...x, contains: !x.contains, count: x.count + (x.contains ? -1 : 1) } : x)) ?? null);
    const r = await post({ action: "toggle", listId: l.id, anilistId, title, coverImage });
    if (r) toast(r.contains ? `Added to ${l.title}` : `Removed from ${l.title}`, r.contains ? "success" : "info");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const r = await post({ action: "create", title: name.trim() });
    if (r?.list) {
      await post({ action: "toggle", listId: r.list.id, anilistId, title, coverImage });
      setLists((ls) => [{ id: r.list.id, title: r.list.title, count: 1, contains: true }, ...(ls ?? [])]);
      setName("");
      toast(`Added to ${r.list.title}`);
    }
    setBusy(false);
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn btn-ghost btn-icon" aria-label="Add to a custom list" title="Add to a custom list" aria-expanded={open}>
        <ListPlus className="h-4 w-4" />
      </button>
      <FloatingPortal>
      <AnimatePresence>
        {open && floating && (
          <motion.div
            ref={menu}
            style={floating}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.13 }}
            className="glass-strong rounded-xl p-1"
          >
            <div className="label px-2.5 pb-1 pt-1.5">Your lists</div>
            <div className="thin-scroll max-h-56 overflow-y-auto">
              {lists === null ? (
                <div className="p-3">
                  <LoaderCircle className="spin mx-auto h-4 w-4 text-muted" />
                </div>
              ) : lists.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-muted">No lists yet — create one below.</p>
              ) : (
                lists.map((l) => (
                  <button key={l.id} onClick={() => toggle(l)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-white/[0.07]">
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${l.contains ? "border-transparent bg-accent text-bg" : "border-white/20"}`}>
                      {l.contains && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 truncate">{l.title}</span>
                    <span className="font-mono text-[11px] text-muted">{l.count}</span>
                  </button>
                ))
              )}
            </div>
            <form onSubmit={create} className="mt-1 flex gap-1 border-t border-white/[0.06] p-1 pt-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list…" maxLength={80} className="input !py-1.5 text-xs" aria-label="New list name" />
              <button disabled={busy || !name.trim()} className="btn btn-primary !px-2 !py-1.5" aria-label="Create list">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      </FloatingPortal>
    </div>
  );
}
