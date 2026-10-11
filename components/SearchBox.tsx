"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, LoaderCircle, Search, X } from "lucide-react";
import { clearRecent, readRecent, type RecentItem } from "@/lib/recent";

type Result = { id: number; title: string; cover: string; year: number | null; format: string | null; episodes: number | null };

export default function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searching = q.trim().length >= 2;
  const list: Result[] = searching ? results : recent.map((r) => ({ id: r.id, title: r.title, cover: r.cover, year: null, format: null, episodes: null }));

  useEffect(() => {
    setActive(-1);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        setResults((await res.json()).results ?? []);
      } catch {}
      setLoading(false);
    }, 250);
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
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(path: string) {
    setOpen(false);
    inputRef.current?.blur();
    router.push(path);
  }

  const showPanel = open && (searching || (q.trim() === "" && recent.length > 0));

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && list[active]) return go(`/anime/${list[active].id}`);
          if (q.trim()) go(`/browse?q=${encodeURIComponent(q.trim())}`);
        }}
        className="group relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-fg" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(list.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search"
          className="input !py-2 !pl-9 !pr-12 text-sm"
          aria-label="Search anime"
        />
        <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <LoaderCircle className="spin h-4 w-4 text-muted" />
          ) : q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              className="press rounded p-0.5 text-muted hover:text-fg"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden rounded border border-white/10 px-1.5 text-[10px] leading-4 text-muted sm:block">/</kbd>
          )}
        </span>
      </form>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="glass-strong absolute right-0 mt-2 w-full min-w-[300px] overflow-hidden rounded-xl p-1"
          >
            {!searching && (
              <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
                <span className="label">Recently viewed</span>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    clearRecent();
                    setRecent([]);
                  }}
                  className="font-mono text-[11px] text-muted hover:text-fg"
                >
                  Clear
                </button>
              </div>
            )}
            {searching && loading && !results.length && (
              <div className="space-y-1 p-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            )}
            {searching && !loading && !results.length && <div className="p-4 text-center text-sm text-muted">No results for &ldquo;{q}&rdquo;</div>}
            {list.map((r, i) => (
              <Link
                key={r.id}
                href={`/anime/${r.id}`}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors ${active === i ? "bg-white/[0.08]" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.cover} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{r.title}</div>
                  <div className="text-xs text-muted">{[r.format, r.year, r.episodes ? `${r.episodes} eps` : null].filter(Boolean).join(" · ")}</div>
                </div>
                {active === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" />}
              </Link>
            ))}
            {searching && results.length > 0 && (
              <Link
                href={`/browse?q=${encodeURIComponent(q.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-1 block border-t border-white/[0.06] px-3 py-2 text-center text-xs text-muted transition-colors hover:text-fg"
              >
                See all results
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
