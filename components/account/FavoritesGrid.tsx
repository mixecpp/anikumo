"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HeartOff, Search } from "lucide-react";
import { toast, undoable } from "@/lib/toast";

type Fav = { anilistId: number; title: string; coverImage: string; addedAt: string };

export default function FavoritesGrid({ initial }: { initial: Fav[] }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "title">("recent");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((f) => f.title.toLowerCase().includes(q));
    return sort === "title" ? [...list].sort((a, b) => a.title.localeCompare(b.title)) : list;
  }, [items, query, sort]);

  function remove(f: Fav) {
    const prev = items;
    setItems((list) => list.filter((x) => x.anilistId !== f.anilistId));
    undoable(`Removed ${f.title}`, {
      commit: async () => {
        const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anilistId: f.anilistId, title: f.title, coverImage: f.coverImage }) });
        if (!res.ok) {
          setItems(prev);
          toast("Couldn't remove favorite", "error");
        }
      },
      revert: () => setItems(prev),
    });
  }

  if (!initial.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
        <p className="text-sm text-muted">Shows you favorite will appear here.</p>
        <Link href="/browse" className="btn btn-ghost mt-4">
          Browse anime
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter favorites" className="input !py-1.5 !pl-9 text-sm" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as "recent" | "title")} className="input !w-auto !py-1.5 text-sm">
          <option value="recent">Recently added</option>
          <option value="title">Title A–Z</option>
        </select>
        <span className="ml-auto text-sm text-muted tabular-nums">{items.length} total</span>
      </div>

      <motion.div layout className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <AnimatePresence initial={false}>
          {shown.map((f) => (
            <motion.div key={f.anilistId} layout exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="group relative">
              <Link href={`/anime/${f.anilistId}`} className="block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.coverImage} alt={f.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.06]" />
                </div>
                <div className="mt-2 line-clamp-1 text-sm text-fg/90">{f.title}</div>
                <div className="text-xs text-muted">Added {new Date(f.addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
              </Link>
              <button
                onClick={() => remove(f)}
                aria-label={`Remove ${f.title} from favorites`}
                className="press absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-bg/80 text-fg/80 opacity-0 backdrop-blur-md transition hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
              >
                <HeartOff className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted">No favorites match &ldquo;{query}&rdquo;.</p>}
    </div>
  );
}
