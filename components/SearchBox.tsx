"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, CornerDownLeft, LoaderCircle, Search, X } from "lucide-react";
import { clearRecent, readRecent, type RecentItem } from "@/lib/recent";
import type { SearchGroup, SearchItem } from "@/app/api/search/route";
import { Avatar } from "./UserMenu";

const PHONE = "(max-width: 767px)";

/** On phones the results fill the screen below the search bar, down to the top of the keyboard. */
function usePhoneSheet(open: boolean, anchor: React.RefObject<HTMLElement | null>) {
  const [phone, setPhone] = useState(false);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !phone) return;
    const vv = window.visualViewport;
    const measure = () => {
      const bottom = anchor.current?.getBoundingClientRect().bottom ?? 64;
      // End above the keyboard or the bottom nav, whichever is higher.
      const navTop = document.querySelector('nav[aria-label="Primary"]')?.getBoundingClientRect().top ?? Infinity;
      const visible = Math.min(vv ? vv.height + vv.offsetTop : window.innerHeight, navTop);
      const top = Math.round(bottom + 8);
      setBox({ top, height: Math.max(160, Math.round(visible - top)) });
    };
    measure();
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [open, phone, anchor]);
  return { phone, box };
}

function recentGroup(recent: RecentItem[]): SearchGroup[] {
  if (!recent.length) return [];
  return [{ kind: "anime", label: "Recently viewed", items: recent.map((r) => ({ kind: "anime", href: `/anime/${r.id}`, title: r.title, subtitle: "", image: r.cover })) }];
}

function Thumb({ item }: { item: SearchItem }) {
  if (item.kind === "user" && item.avatar) return <Avatar name={item.title} color={item.avatar.color} avatar={item.avatar.value} size={36} />;
  if (!item.image)
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-muted">
        <Building2 className="h-4 w-4" />
      </span>
    );
  const round = item.kind === "character" || item.kind === "staff";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.image} alt="" loading="lazy" className={`shrink-0 object-cover ${round ? "h-9 w-9 rounded-full object-[center_15%]" : "h-12 w-9 rounded"}`} />
  );
}

export default function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searching = q.trim().length >= 2;
  const shown = searching ? groups : recentGroup(recent);
  const showPanel = open && (searching || recent.length > 0);
  const { phone, box } = usePhoneSheet(open, boxRef);
  const flat = shown.flatMap((g) => g.items);

  useEffect(() => {
    setActive(-1);
    setError("");
    if (q.trim().length < 2) {
      setGroups([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const json = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal }).then((r) => r.json());
        setGroups(json.groups ?? []);
        setError(json.error ?? "");
      } catch {}
      setLoading(false);
    }, 220);
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

  const optionId = (i: number) => `${listId}-opt-${i}`;
  let index = -1;

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && flat[active]) return go(flat[active].href);
          if (q.trim()) go(`/browse?q=${encodeURIComponent(q.trim())}`);
        }}
        className="group relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-fg" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
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
              setActive((a) => Math.min(flat.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search anime, characters, people…"
          className="input !py-2 !pl-9 !pr-12 text-sm [&::-webkit-search-cancel-button]:hidden"
          aria-label="Search anime, characters, people and studios"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <LoaderCircle className="spin h-4 w-4 text-muted" />
          ) : q || (phone && open) ? (
            <button
              type="button"
              onClick={() => {
                if (!q) {
                  setOpen(false);
                  inputRef.current?.blur();
                  return;
                }
                setQ("");
                inputRef.current?.focus();
              }}
              className="press rounded p-0.5 text-muted hover:text-fg"
              aria-label={q ? "Clear search" : "Close search"}
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
            className={
              phone
                ? "fixed inset-x-0 z-50 overflow-y-auto overscroll-contain border-t border-white/[0.06] bg-bg px-2 pb-3 pt-1"
                : "glass-strong absolute right-0 mt-2 max-h-[min(70dvh,560px)] w-full min-w-[320px] overflow-y-auto overscroll-contain rounded-xl p-1"
            }
            style={phone && box ? { top: box.top, height: box.height } : undefined}
            // Scrolling the results on a phone tucks the keyboard away so more of them fit.
            onTouchMove={phone ? () => inputRef.current?.blur() : undefined}
          >
            <div id={listId} role="listbox" aria-label="Search results">
              {searching && loading && !groups.length && (
                <div className="space-y-1 p-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-12 rounded-lg" />
                  ))}
                </div>
              )}
              {searching && !loading && !groups.length && <div className="p-4 text-center text-sm text-muted">{error || <>No results for &ldquo;{q}&rdquo;</>}</div>}

              {shown.map((g) => (
                <Fragment key={g.label}>
                  <div className="flex items-center justify-between px-2 pb-1 pt-2" role="presentation">
                    <span className="label">{g.label}</span>
                    {!searching && (
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
                    )}
                  </div>
                  {g.items.map((item) => {
                    index += 1;
                    const i = index;
                    return (
                      <Link
                        key={item.href}
                        id={optionId(i)}
                        role="option"
                        aria-selected={active === i}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex items-center gap-3 rounded-lg px-2 transition-colors ${phone ? "py-2.5" : "py-1.5"} ${active === i ? "bg-white/[0.08]" : ""}`}
                      >
                        <Thumb item={item} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{item.title}</div>
                          {item.subtitle && <div className="truncate text-xs text-muted">{item.subtitle}</div>}
                        </div>
                        {active === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" />}
                      </Link>
                    );
                  })}
                </Fragment>
              ))}
            </div>
            {searching && groups.length > 0 && (
              <Link
                href={`/browse?q=${encodeURIComponent(q.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-1 block border-t border-white/[0.06] px-3 py-2 text-center text-xs text-muted transition-colors hover:text-fg"
              >
                See all anime for &ldquo;{q.trim()}&rdquo;
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
