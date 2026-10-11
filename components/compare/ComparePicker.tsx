"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

type Hit = { id: number; title: string; cover: string; year: number | null; format: string | null };

function Slot({ label, current, onPick, onClear }: { label: string; current: { id: number; title: string; cover: string } | null; onPick: (h: Hit) => void; onClear: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const j = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal }).then((r) => r.json());
        setHits(j.results ?? []);
      } catch {}
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (current) {
    return (
      <div className="panel flex items-center gap-3 rounded-xl p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.cover} alt="" className="h-12 w-9 rounded object-cover" />
        <div className="min-w-0 flex-1">
          <div className="label !text-[10px]">{label}</div>
          <div className="truncate text-sm">{current.title}</div>
        </div>
        <button onClick={onClear} className="rounded-lg p-2 text-muted hover:bg-white/[0.06] hover:text-fg" aria-label={`Change ${label}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={`${label}: search a show`} className="input !py-3 !pl-9 text-sm" aria-label={label} />
      {loading && <LoaderCircle className="spin absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
      {open && hits.length > 0 && (
        <ul className="glass-strong absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl p-1">
          {hits.map((h) => (
            <li key={h.id}>
              <button onClick={() => { onPick(h); setQ(""); setOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.07]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.cover} alt="" className="h-10 w-7 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{h.title}</span>
                  <span className="text-xs text-muted">{[h.format, h.year].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ComparePicker({ a, b }: { a: { id: number; title: string; cover: string } | null; b: { id: number; title: string; cover: string } | null }) {
  const router = useRouter();
  const go = (na: number | null, nb: number | null) => {
    const qs = new URLSearchParams();
    if (na) qs.set("a", String(na));
    if (nb) qs.set("b", String(nb));
    router.push(`/compare${qs.size ? `?${qs}` : ""}`);
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Slot label="First show" current={a} onPick={(h) => go(h.id, b?.id ?? null)} onClear={() => go(null, b?.id ?? null)} />
      <Slot label="Second show" current={b} onPick={(h) => go(a?.id ?? null, h.id)} onClear={() => go(a?.id ?? null, null)} />
    </div>
  );
}
