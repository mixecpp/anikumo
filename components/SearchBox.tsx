"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Result = { id: number; title: string; cover: string; year: number | null; format: string | null; episodes: number | null };

export default function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const json = await res.json();
        setResults(json.results ?? []);
      } catch {}
      setLoading(false);
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        boxRef.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          setOpen(false);
          router.push(`/browse?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search anime…  ( / )"
          className="input !rounded-full !py-2 !pl-9 text-sm"
        />
      </form>
      {open && q.trim().length >= 2 && (
        <div className="fade-in absolute right-0 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60">
          {loading && !results.length && <div className="p-4 text-sm text-muted">Searching…</div>}
          {!loading && !results.length && <div className="p-4 text-sm text-muted">No results</div>}
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/anime/${r.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 transition hover:bg-white/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.cover} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="text-xs text-muted">
                  {[r.format, r.year, r.episodes ? `${r.episodes} eps` : null].filter(Boolean).join(" · ")}
                </div>
              </div>
            </Link>
          ))}
          {results.length > 0 && (
            <Link
              href={`/browse?q=${encodeURIComponent(q.trim())}`}
              onClick={() => setOpen(false)}
              className="block border-t border-line px-3 py-2.5 text-center text-sm text-accent hover:bg-white/5"
            >
              See all results
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
