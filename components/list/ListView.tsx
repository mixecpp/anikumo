"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Grid3x3, List as ListIcon, Pencil, Plus, Repeat, Search, Star, Tag, Trash2, Upload, X } from "lucide-react";
import { LIST_STATUSES, STATUS_DOT, STATUS_LABEL, type ListEntryDTO, type ListStatus } from "@/lib/list-shared";
import { toast, undoable } from "@/lib/toast";
import Select from "../Select";
import EntryEditor from "./EntryEditor";

type Meta = Record<number, { total: number | null; format: string | null; year: number | null; newEpisodes: number }>;

const SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
  { value: "score", label: "Your score" },
  { value: "progress", label: "Progress" },
];

async function post(body: object) {
  const res = await fetch("/api/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Couldn't save", "error");
  return res.ok ? (json.entry as ListEntryDTO) : null;
}

export default function ListView({ initial, meta }: { initial: ListEntryDTO[]; meta: Meta }) {
  const [entries, setEntries] = useState(initial);
  const [tab, setTab] = useState<"ALL" | ListStatus>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [tag, setTag] = useState("");
  const [grid, setGrid] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<ListEntryDTO | null>(null);
  const [bulkTag, setBulkTag] = useState("");

  const counts = useMemo(() => Object.fromEntries(LIST_STATUSES.map((s) => [s, entries.filter((e) => e.status === s).length])), [entries]);
  const allTags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags))].sort(), [entries]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((e) => (tab === "ALL" || e.status === tab) && (!q || e.title.toLowerCase().includes(q)) && (!tag || e.tags.includes(tag)));
    return [...list].sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "score"
          ? (b.score ?? -1) - (a.score ?? -1)
          : sort === "progress"
            ? b.progress / (meta[b.anilistId]?.total || b.progress || 1) - a.progress / (meta[a.anilistId]?.total || a.progress || 1)
            : b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [entries, tab, query, tag, sort, meta]);

  const replace = (e: ListEntryDTO) => setEntries((list) => list.map((x) => (x.anilistId === e.anilistId ? e : x)));

  async function bump(e: ListEntryDTO) {
    const total = meta[e.anilistId]?.total;
    if (total && e.progress >= total) return;
    const next = e.progress + 1;
    const patch: Partial<ListEntryDTO> = { progress: next, ...(total && next >= total ? { status: "COMPLETED" as const } : e.status === "PLANNING" ? { status: "WATCHING" as const } : {}) };
    replace({ ...e, ...patch });
    const saved = await post({ anilistId: e.anilistId, ...patch });
    if (saved) {
      replace(saved);
      if (saved.status === "COMPLETED" && e.status !== "COMPLETED") toast(`Completed ${e.title} 🎉`);
    } else replace(e);
  }

  function remove(ids: number[]) {
    const removed = entries.filter((e) => ids.includes(e.anilistId));
    setEntries((list) => list.filter((e) => !ids.includes(e.anilistId)));
    setSelected(new Set());
    undoable(ids.length === 1 ? `Removed ${removed[0]?.title}` : `Removed ${ids.length} shows`, {
      commit: () => fetch("/api/list", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, remove: true }) }),
      revert: () => setEntries((list) => [...removed, ...list]),
    });
  }

  async function bulk(body: object, apply: (e: ListEntryDTO) => ListEntryDTO, msg: string) {
    const ids = [...selected];
    setEntries((list) => list.map((e) => (selected.has(e.anilistId) ? apply(e) : e)));
    const res = await fetch("/api/list", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ...body }) });
    if (!res.ok) return toast("Bulk edit failed", "error");
    toast(msg);
    setSelected(new Set());
  }

  const toggleSel = (id: number) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const allSelected = shown.length > 0 && shown.every((e) => selected.has(e.anilistId));

  if (!initial.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
        <p className="text-sm text-muted">Your list is empty. Add shows from any anime page, or import your existing list.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/browse" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Find shows
          </Link>
          <Link href="/account/settings#import" className="btn btn-ghost">
            <Upload className="h-4 w-4" /> Import from MAL / AniList
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { key: "ALL" | ListStatus; label: string; count: number }[] = [{ key: "ALL", label: "All", count: entries.length }, ...LIST_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], count: counts[s] }))];

  return (
    <div>
      <div className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`relative shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${tab === t.key ? "text-fg" : "text-muted hover:text-fg"}`}>
            {tab === t.key && <motion.span layoutId="list-tab" className="absolute inset-0 rounded-lg bg-white/[0.08]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative flex items-center gap-1.5">
              {t.key !== "ALL" && <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.key]}`} />}
              {t.label} <span className="font-mono text-[11px] text-muted">{t.count}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter list" className="input !py-2 !pl-9 text-sm" aria-label="Filter list" />
        </label>
        <Select label="Sort" value={sort} onChange={setSort} options={SORTS} className="w-40" />
        {allTags.length > 0 && (
          <Select label="Tag" value={tag} onChange={setTag} options={[{ value: "", label: "All tags" }, ...allTags.map((t) => ({ value: t, label: `#${t}` }))]} className="w-36" icon={<Tag className="h-3.5 w-3.5 shrink-0 text-muted" />} />
        )}
        <div className="ml-auto flex rounded-[10px] border border-white/[0.08] bg-white/[0.04] p-0.5">
          {[false, true].map((g) => (
            <button key={String(g)} onClick={() => setGrid(g)} aria-pressed={grid === g} aria-label={g ? "Grid view" : "List view"} className={`grid h-8 w-9 place-items-center rounded-lg ${grid === g ? "bg-white/[0.1] text-fg" : "text-muted hover:text-fg"}`}>
              {g ? <Grid3x3 className="h-4 w-4" /> : <ListIcon className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="glass-strong sticky top-20 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl p-2">
            <span className="px-2 text-sm">{selected.size} selected</span>
            <Select
              label="Set status"
              value=""
              placeholder="Set status…"
              onChange={(s) => s && bulk({ status: s }, (e) => ({ ...e, status: s as ListStatus }), `Moved to ${STATUS_LABEL[s as ListStatus]}`)}
              options={LIST_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              className="w-40"
            />
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                const t = bulkTag.trim().toLowerCase();
                if (t) bulk({ addTag: t }, (e) => ({ ...e, tags: [...new Set([...e.tags, t])] }), `Tagged #${t}`);
                setBulkTag("");
              }}
              className="flex"
            >
              <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="Add tag…" className="input !w-32 !py-2 text-xs" aria-label="Tag selected" />
            </form>
            <button onClick={() => remove([...selected])} className="btn btn-ghost !py-2 !text-xs text-red-300">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto rounded-lg p-2 text-muted hover:text-fg" aria-label="Clear selection">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Nothing here.</p>
      ) : grid ? (
        <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
          {shown.map((e) => {
            const m = meta[e.anilistId];
            return (
              <div key={e.anilistId} className="group relative">
                <Link href={`/anime/${e.anilistId}`} className="block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.04]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.coverImage} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6 font-mono text-[10px] text-[#fff]">
                      {e.progress}/{m?.total ?? "?"}
                      {e.score ? ` · ★${e.score}` : ""}
                    </span>
                    {m?.newEpisodes ? <span className="absolute right-1.5 top-1.5 rounded bg-accent px-1 font-mono text-[10px] text-bg">+{m.newEpisodes}</span> : null}
                  </div>
                  <div className="mt-1.5 line-clamp-1 text-xs">{e.title}</div>
                </Link>
                <button onClick={() => setEditing(e)} className="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-bg/80 opacity-0 backdrop-blur transition group-hover:opacity-100" aria-label={`Edit ${e.title}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.06]">
          <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
            <Checkbox on={allSelected} onClick={() => setSelected(allSelected ? new Set() : new Set(shown.map((e) => e.anilistId)))} label="Select all" />
            <span className="flex-1">Title</span>
            <span className="hidden w-28 sm:block">Progress</span>
            <span className="hidden w-14 text-right sm:block">Score</span>
            <span className="w-16" />
          </div>
          <ul className="divide-y divide-white/[0.05]">
            <AnimatePresence initial={false}>
              {shown.map((e) => {
                const m = meta[e.anilistId];
                const pct = m?.total ? Math.min(100, (e.progress / m.total) * 100) : 0;
                return (
                  <motion.li key={e.anilistId} layout exit={{ opacity: 0, height: 0 }} className={`group flex items-center gap-3 px-3 py-2.5 transition-colors ${selected.has(e.anilistId) ? "bg-accent/[0.05]" : "hover:bg-white/[0.02]"}`}>
                    <Checkbox on={selected.has(e.anilistId)} onClick={() => toggleSel(e.anilistId)} label={`Select ${e.title}`} />
                    <Link href={`/anime/${e.anilistId}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.coverImage} alt="" loading="lazy" className="h-14 w-10 rounded object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/anime/${e.anilistId}`} className="truncate text-sm hover:underline">
                          {e.title}
                        </Link>
                        {m?.newEpisodes ? <span className="shrink-0 rounded-full bg-accent/15 px-1.5 font-mono text-[10px] text-accent">{m.newEpisodes} new</span> : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                        <span className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[e.status]}`} />
                          {STATUS_LABEL[e.status]}
                        </span>
                        {e.rewatching && (
                          <span className="flex items-center gap-1 text-accent">
                            <Repeat className="h-3 w-3" /> Rewatching · Ep {e.rewatchEpisode}
                          </span>
                        )}
                        {e.tags.map((t) => (
                          <button key={t} onClick={() => setTag(t)} className="hover:text-fg">
                            #{t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="hidden w-28 sm:block">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="tabular-nums">
                          {e.progress}/{m?.total ?? "?"}
                        </span>
                        {e.status !== "COMPLETED" && (!m?.total || e.progress < m.total) && (
                          <button onClick={() => bump(e)} className="press rounded bg-white/[0.06] px-1.5 text-[11px] text-muted hover:bg-white/[0.12] hover:text-fg" aria-label="One more episode">
                            +1
                          </button>
                        )}
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className={`h-full ${e.status === "COMPLETED" ? "bg-success" : "bg-accent"}`} style={{ width: `${e.status === "COMPLETED" ? 100 : pct}%` }} />
                      </div>
                    </div>
                    <span className="hidden w-14 text-right font-mono text-xs sm:block">
                      {e.score ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-star text-star" />
                          {e.score}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </span>
                    <div className="flex w-16 justify-end gap-0.5">
                      <button onClick={() => setEditing(e)} className="rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-fg" aria-label={`Edit ${e.title}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove([e.anilistId])} className="rounded-lg p-1.5 text-muted opacity-60 hover:bg-white/[0.06] hover:text-fg group-hover:opacity-100" aria-label={`Remove ${e.title}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <EntryEditor
        open={!!editing}
        onClose={() => setEditing(null)}
        entry={editing}
        title={editing?.title ?? ""}
        coverImage={editing?.coverImage ?? ""}
        total={editing ? meta[editing.anilistId]?.total ?? null : null}
        onSave={async (patch) => {
          if (!editing) return;
          const saved = await post({ anilistId: editing.anilistId, ...patch });
          if (saved) {
            replace(saved);
            toast("Saved");
          }
        }}
        onRemove={() => editing && remove([editing.anilistId])}
      />
    </div>
  );
}

function Checkbox({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} role="checkbox" aria-checked={on} aria-label={label} className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${on ? "border-transparent bg-accent text-bg" : "border-white/25 hover:border-white/50"}`}>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}
