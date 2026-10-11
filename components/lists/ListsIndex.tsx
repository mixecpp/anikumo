"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Globe, Lock, Plus } from "lucide-react";
import { toast } from "@/lib/toast";

type L = { id: string; title: string; description: string; isPublic: boolean; count: number; covers: string[]; updatedAt: string };

export default function ListsIndex({ initial }: { initial: L[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const res = await fetch("/api/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(json.error ?? "Couldn't create list", "error");
    router.push(`/account/lists/${json.list.id}`);
  }

  return (
    <div>
      <form onSubmit={create} className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="New list name, e.g. Comfort shows" className="input max-w-sm text-sm" aria-label="New list name" />
        <button disabled={busy || !title.trim()} className="btn btn-primary">
          <Plus className="h-4 w-4" /> Create
        </button>
      </form>

      {initial.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center text-sm text-muted">
          Make lists like “Best of 2025” or “Watch with friends”, then share them. You can also add shows from any anime page.
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initial.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 9) * 0.03 }}>
              <Link href={`/account/lists/${l.id}`} className="panel group block overflow-hidden rounded-2xl transition-colors hover:border-white/15">
                <div className="grid h-28 grid-cols-4 gap-px bg-white/[0.04]">
                  {Array.from({ length: 4 }, (_, k) =>
                    l.covers[k] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={k} src={l.covers[k]} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div key={k} className="bg-white/[0.02]" />
                    ),
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-medium">{l.title}</span>
                    {l.isPublic ? <Globe className="h-3.5 w-3.5 text-muted" aria-label="Public" /> : <Lock className="h-3.5 w-3.5 text-muted" aria-label="Private" />}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted">
                    {l.count} show{l.count === 1 ? "" : "s"} · updated {new Date(l.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  {l.description && <p className="mt-2 line-clamp-2 text-xs text-muted">{l.description}</p>}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
