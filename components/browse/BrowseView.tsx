"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpDown, Bookmark, Dices, Grid3x3, LayoutGrid, LoaderCircle, RotateCcw, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import type { BrowseParams, MediaCard } from "@/lib/anilist";
import { browseQuery, DURATIONS, FORMATS, GENRE_LIST, LENGTHS, SCORES, SEASONS, SORT_OPTIONS, STATUSES, VIBES } from "@/lib/browse-params";
import { toast } from "@/lib/toast";
import AnimeCard from "../AnimeCard";
import Select from "../Select";
import TagPicker from "./TagPicker";
import { usePrefs, useT } from "../PrefsProvider";

type Page = { media: MediaCard[]; hasNextPage: boolean };
type Preset = { id: string; name: string; query: string };

const label = (list: [string, string][], v?: string) => list.find(([k]) => k === v)?.[1] ?? v;
const RESTORE_KEY = "aw_browse_restore";

export default function BrowseView({ params, initial, error, presets: initialPresets, hiddenEcchi }: { params: BrowseParams; initial: Page | null; error?: string; presets: Preset[]; hiddenEcchi: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const { loggedIn } = usePrefs();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dense, setDense] = useState(false);
  const [presets, setPresets] = useState(initialPresets);
  const [surprising, setSurprising] = useState(false);

  useEffect(() => {
    try {
      setDense(localStorage.getItem("aw_density") === "compact");
    } catch {}
  }, []);
  const toggleDense = (value: boolean) => {
    setDense(value);
    try {
      localStorage.setItem("aw_density", value ? "compact" : "comfortable");
    } catch {}
  };

  const apply = useCallback(
    (overrides: Partial<BrowseParams>) => {
      const qs = browseQuery(params, { ...overrides, page: undefined });
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  /** Genre chips cycle: off → include → exclude → off. */
  const cycleGenre = (g: string) => {
    const inc = new Set(params.genres ?? []);
    const exc = new Set(params.excludeGenres ?? []);
    if (inc.has(g)) {
      inc.delete(g);
      exc.add(g);
    } else if (exc.has(g)) exc.delete(g);
    else inc.add(g);
    apply({ genres: [...inc], excludeGenres: [...exc] });
  };

  const active: { key: string; text: string; neg?: boolean; clear: () => void }[] = [
    ...(params.q ? [{ key: "q", text: `“${params.q}”`, clear: () => apply({ q: undefined }) }] : []),
    ...(params.genres ?? []).map((g) => ({ key: `g-${g}`, text: g, clear: () => apply({ genres: params.genres!.filter((x) => x !== g) }) })),
    ...(params.excludeGenres ?? []).map((g) => ({ key: `xg-${g}`, text: g, neg: true, clear: () => apply({ excludeGenres: params.excludeGenres!.filter((x) => x !== g) }) })),
    ...(params.tags ?? []).map((g) => ({ key: `t-${g}`, text: `#${g}`, clear: () => apply({ tags: params.tags!.filter((x) => x !== g) }) })),
    ...(params.excludeTags ?? []).map((g) => ({ key: `xt-${g}`, text: `#${g}`, neg: true, clear: () => apply({ excludeTags: params.excludeTags!.filter((x) => x !== g) }) })),
    ...(params.season ? [{ key: "season", text: label(SEASONS, params.season)!, clear: () => apply({ season: undefined }) }] : []),
    ...(params.year ? [{ key: "year", text: String(params.year), clear: () => apply({ year: undefined }) }] : []),
    ...(params.format ? [{ key: "format", text: label(FORMATS, params.format)!, clear: () => apply({ format: undefined }) }] : []),
    ...(params.status ? [{ key: "status", text: label(STATUSES, params.status)!, clear: () => apply({ status: undefined }) }] : []),
    ...(params.minScore ? [{ key: "score", text: `★ ${(params.minScore / 10).toFixed(1)}+`, clear: () => apply({ minScore: undefined }) }] : []),
    ...(params.length ? [{ key: "length", text: label(LENGTHS, params.length)!, clear: () => apply({ length: undefined }) }] : []),
    ...(params.duration ? [{ key: "duration", text: label(DURATIONS, params.duration)!, clear: () => apply({ duration: undefined }) }] : []),
    ...(params.maxPopularity ? [{ key: "pop", text: "Hidden gems", clear: () => apply({ maxPopularity: undefined }) }] : []),
  ];
  const filterCount = active.filter((a) => a.key !== "q").length;
  const clearAll = () => startTransition(() => router.replace(pathname, { scroll: false }));
  const currentQuery = browseQuery(params);

  async function surprise() {
    setSurprising(true);
    try {
      const res = await fetch(`/api/surprise?${currentQuery}`);
      const json = await res.json();
      if (!res.ok || !json.id) throw new Error(json.error ?? "Nothing matches those filters");
      router.push(`/anime/${json.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't pick something", "error");
      setSurprising(false);
    }
  }

  async function savePreset() {
    const name = window.prompt("Name this view", active.slice(0, 3).map((a) => a.text).join(" · ").slice(0, 40));
    if (!name?.trim()) return;
    const res = await fetch("/api/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, query: currentQuery }) });
    const json = await res.json();
    if (!res.ok) return toast(json.error ?? "Couldn't save", "error");
    setPresets((p) => [...p, json.preset]);
    toast("View saved");
  }

  async function deletePreset(id: string) {
    setPresets((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/presets?id=${id}`, { method: "DELETE" });
  }

  const filters = <FilterPanel params={params} apply={apply} cycleGenre={cycleGenre} />;

  return (
    <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">
        <div className="thin-scroll sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-2">{filters}</div>
      </aside>

      <div className="min-w-0">
        <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {VIBES.map((v) => {
            const on = browseQuery(v.params as BrowseParams) === currentQuery;
            return (
              <button
                key={v.id}
                onClick={() => (on ? clearAll() : startTransition(() => router.replace(`${pathname}?${browseQuery(v.params as BrowseParams)}`, { scroll: false })))}
                title={v.hint}
                className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on ? "border-transparent bg-fg text-bg" : "border-white/[0.08] text-muted hover:border-white/20 hover:text-fg"}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <SearchInput value={params.q ?? ""} onSearch={(q) => apply({ q: q || undefined })} pending={pending} placeholder={t("browse.search")} />
          <Select
            label="Sort by"
            value={params.sort ?? (params.q ? "relevance" : "popularity")}
            onChange={(sort) => apply({ sort })}
            options={SORT_OPTIONS.filter(([k]) => params.q || k !== "relevance").map(([value, l]) => ({ value, label: l }))}
            className="w-44"
            align="right"
            icon={<ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted" />}
          />
          <button onClick={surprise} disabled={surprising} className="btn btn-ghost" title="Open a random show matching these filters">
            {surprising ? <LoaderCircle className="spin h-4 w-4" /> : <Dices className="h-4 w-4" />}
            <span className="hidden sm:inline">{t("common.surprise")}</span>
          </button>
          <div className="hidden rounded-[10px] border border-white/[0.08] bg-white/[0.04] p-0.5 sm:flex" role="group" aria-label="Grid density">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                onClick={() => toggleDense(v)}
                aria-pressed={dense === v}
                title={v ? "Compact grid" : "Comfortable grid"}
                className={`grid w-9 place-items-center rounded-lg transition-colors ${dense === v ? "bg-white/[0.1] text-fg" : "text-muted hover:text-fg"}`}
              >
                {v ? <Grid3x3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </button>
            ))}
          </div>
          <button onClick={() => setSheetOpen(true)} className="btn btn-ghost relative lg:hidden" aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t("browse.filters")}</span>
            {filterCount > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-fg px-1 text-[10px] font-semibold text-bg">{filterCount}</span>}
          </button>
        </div>

        {(presets.length > 0 || (loggedIn && filterCount > 0)) && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {presets.map((p) => (
              <span key={p.id} className="group flex items-center rounded-full bg-white/[0.05] text-xs">
                <Link href={`/browse?${p.query}`} className={`flex items-center gap-1.5 py-1 pl-3 pr-1.5 ${p.query === currentQuery ? "text-fg" : "text-fg/70 hover:text-fg"}`}>
                  <Bookmark className={`h-3 w-3 ${p.query === currentQuery ? "fill-current" : ""}`} />
                  {p.name}
                </Link>
                <button onClick={() => deletePreset(p.id)} className="rounded-full p-1 pr-2 text-muted opacity-0 transition hover:text-fg group-hover:opacity-100" aria-label={`Delete ${p.name}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {loggedIn && filterCount > 0 && !presets.some((p) => p.query === currentQuery) && (
              <button onClick={savePreset} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted transition-colors hover:text-fg">
                <Bookmark className="h-3 w-3" /> {t("browse.savePreset")}
              </button>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {active.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 pt-4">
                {active.map((a) => (
                  <button
                    key={a.key}
                    onClick={a.clear}
                    className={`press group flex items-center gap-1 rounded-full py-1 pl-3 pr-2 text-xs transition-colors ${a.neg ? "bg-red-500/10 text-red-300 hover:bg-red-500/20" : "bg-white/[0.07] hover:bg-white/[0.12]"}`}
                  >
                    {a.neg && <span className="text-[10px] uppercase">not</span>}
                    {a.text}
                    <X className="h-3 w-3 text-muted transition-colors group-hover:text-fg" />
                  </button>
                ))}
                <button onClick={clearAll} className="ml-1 flex items-center gap-1 text-xs text-muted transition-colors hover:text-fg">
                  <RotateCcw className="h-3 w-3" /> {t("browse.clearAll")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {hiddenEcchi && (
          <p className="mt-3 text-xs text-muted">
            Ecchi titles are hidden by your{" "}
            <Link href="/account/settings#content" className="underline underline-offset-2 hover:text-fg">
              content settings
            </Link>
            .
          </p>
        )}

        <div className={`mt-8 transition-opacity duration-200 ${pending ? "pointer-events-none opacity-40" : ""}`}>
          {error ? (
            <EmptyState title="Couldn't load results" text={error} action={{ label: "Try again", onClick: () => router.refresh() }} />
          ) : initial && initial.media.length === 0 ? (
            <EmptyState
              title="No anime found"
              text={active.length ? "Try removing a filter or searching for something else." : "Nothing to show yet."}
              action={active.length ? { label: "Clear filters", onClick: clearAll } : undefined}
            />
          ) : initial ? (
            <Results key={currentQuery} query={currentQuery} initial={initial} dense={dense} loadMoreLabel={t("browse.loadMore")} />
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheetOpen(false)} className="fixed inset-0 z-50 bg-black/60 lg:hidden" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="glass-strong fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl p-5 pb-8 lg:hidden"
              role="dialog"
              aria-label="Filters"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold">{t("browse.filters")}</h2>
                <button onClick={() => setSheetOpen(false)} className="press rounded-lg p-1.5 text-muted hover:text-fg" aria-label="Close filters">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {filters}
              <button onClick={() => setSheetOpen(false)} className="btn btn-primary mt-6 w-full">
                Show results
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchInput({ value, onSearch, pending, placeholder }: { value: string; onSearch: (q: string) => void; pending: boolean; placeholder: string }) {
  const [text, setText] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    setText(value);
    last.current = value;
  }, [value]);
  useEffect(() => {
    const v = text.trim();
    if (v === last.current) return;
    const timer = setTimeout(() => {
      last.current = v;
      onSearch(v);
    }, 450);
    return () => clearTimeout(timer);
  }, [text, onSearch]);

  return (
    <form
      className="group relative min-w-[200px] flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        last.current = text.trim();
        onSearch(text.trim());
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-fg" />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="input !pl-9 !pr-9 text-sm" aria-label={placeholder} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <LoaderCircle className="spin h-4 w-4 text-muted" />
        ) : text ? (
          <button type="button" onClick={() => setText("")} className="text-muted hover:text-fg" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </span>
    </form>
  );
}

function Pills<T extends string | number>({ value, options, onChange }: { value: T | undefined; options: [T, string][]; onChange: (v: T | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([k, l]) => {
        const on = value === k;
        return (
          <button
            key={String(k)}
            onClick={() => onChange(on ? undefined : k)}
            aria-pressed={on}
            className={`press rounded-full px-3 py-1 text-xs transition-colors ${on ? "bg-fg text-bg" : "bg-white/[0.06] text-fg/75 hover:bg-white/[0.1] hover:text-fg"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function FilterPanel({ params, apply, cycleGenre }: { params: BrowseParams; apply: (o: Partial<BrowseParams>) => void; cycleGenre: (g: string) => void }) {
  const t = useT();
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: thisYear + 2 - 1960 }, (_, i) => String(thisYear + 1 - i)), [thisYear]);
  const inc = new Set(params.genres ?? []);
  const exc = new Set(params.excludeGenres ?? []);

  return (
    <div className="space-y-7">
      <Group title={t("browse.genres")} hint="Click twice to exclude">
        <div className="flex flex-wrap gap-1.5">
          {GENRE_LIST.map((g) => {
            const state = inc.has(g) ? "inc" : exc.has(g) ? "exc" : "off";
            return (
              <button
                key={g}
                onClick={() => cycleGenre(g)}
                aria-pressed={state !== "off"}
                title={state === "exc" ? `Excluding ${g}` : state === "inc" ? `Including ${g}` : g}
                className={`press rounded-full px-3 py-1 text-xs transition-colors ${
                  state === "inc" ? "bg-fg text-bg" : state === "exc" ? "bg-red-500/15 text-red-300 line-through decoration-red-300/60" : "bg-white/[0.06] text-fg/75 hover:bg-white/[0.1] hover:text-fg"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </Group>
      <Group title={t("browse.tags")}>
        <div className="space-y-2.5">
          <TagPicker tone="include" value={params.tags ?? []} onChange={(tags) => apply({ tags })} placeholder="Include tag, e.g. Time Travel" exclude={params.excludeTags} />
          <TagPicker tone="exclude" value={params.excludeTags ?? []} onChange={(excludeTags) => apply({ excludeTags })} placeholder="Exclude tag, e.g. Isekai" exclude={params.tags} />
        </div>
      </Group>
      <Group title={t("browse.minScore")}>
        <Pills value={params.minScore} options={SCORES.map((s) => [s, `${(s / 10).toFixed(1)}+`] as [number, string])} onChange={(minScore) => apply({ minScore })} />
      </Group>
      <Group title={t("browse.length")}>
        <Pills value={params.length} options={LENGTHS} onChange={(length) => apply({ length })} />
      </Group>
      <Group title={t("browse.duration")}>
        <Pills value={params.duration} options={DURATIONS} onChange={(duration) => apply({ duration })} />
      </Group>
      <Group title={t("browse.format")}>
        <Pills value={params.format} options={FORMATS} onChange={(format) => apply({ format })} />
      </Group>
      <Group title={t("browse.status")}>
        <Pills value={params.status} options={STATUSES} onChange={(status) => apply({ status })} />
      </Group>
      <Group title={t("browse.season")}>
        <Pills value={params.season} options={SEASONS} onChange={(season) => apply({ season })} />
      </Group>
      <Group title={t("browse.year")}>
        <Select
          label="Year"
          value={params.year ? String(params.year) : ""}
          onChange={(v) => apply({ year: v ? Number(v) : undefined })}
          options={[{ value: "", label: "Any year" }, ...years.map((y) => ({ value: y, label: y }))]}
          placeholder="Any year"
        />
      </Group>
      <Group title="Discovery">
        <Pills value={params.maxPopularity ? 1 : undefined} options={[[1, "Hidden gems only"]]} onChange={(v) => apply({ maxPopularity: v ? 40000 : undefined, minScore: v ? params.minScore ?? 75 : params.minScore })} />
      </Group>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="label">{title}</h3>
        {hint && <span className="text-[10px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

type Saved = { items: MediaCard[]; page: number; hasMore: boolean; scrollY: number; at: number };

function Results({ query, initial, dense, loadMoreLabel }: { query: string; initial: Page; dense: boolean; loadMoreLabel: string }) {
  const storeKey = `aw_browse:${query}`;
  const [items, setItems] = useState(initial.media);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.hasNextPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const state = useRef({ items, page, hasMore });
  state.current = { items, page, hasMore };

  // Restore the exact list and scroll position when returning from an anime page.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(RESTORE_KEY) !== query) return;
      sessionStorage.removeItem(RESTORE_KEY);
      const saved = JSON.parse(sessionStorage.getItem(storeKey) ?? "null") as Saved | null;
      if (!saved || Date.now() - saved.at > 30 * 60_000) return;
      setItems(saved.items);
      setPage(saved.page);
      setHasMore(saved.hasMore);
      const restore = () => window.scrollTo({ top: saved.scrollY, behavior: "instant" as ScrollBehavior });
      requestAnimationFrame(restore);
      setTimeout(restore, 120);
    } catch {}
  }, [query, storeKey]);

  const remember = () => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify({ ...state.current, scrollY: window.scrollY, at: Date.now() } satisfies Saved));
      sessionStorage.setItem(RESTORE_KEY, query);
    } catch {}
  };

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/browse?${query}${query ? "&" : ""}page=${page + 1}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Page;
      setItems((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.media.filter((m) => !seen.has(m.id))];
      });
      setPage((p) => p + 1);
      setHasMore(data.hasNextPage);
    } catch {
      setFailed(true);
    }
    setLoading(false);
  }, [loading, hasMore, page, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || failed) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, failed]);

  return (
    <>
      <div
        onClickCapture={(e) => (e.target as HTMLElement).closest("a") && remember()}
        className={`grid ${
          dense ? "grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8" : "grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        }`}
      >
        {items.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: (i % 30) * 0.015, ease: [0.16, 1, 0.3, 1] }}>
            <AnimeCard m={m} />
          </motion.div>
        ))}
        {loading &&
          Array.from({ length: 10 }, (_, i) => (
            <div key={`s${i}`}>
              <div className="skeleton aspect-[2/3] rounded-xl" />
              <div className="skeleton mt-2.5 h-3.5 w-3/4 rounded" />
            </div>
          ))}
      </div>
      <div ref={sentinel} className="h-px" />
      {hasMore && !loading && !failed && (
        <div className="mt-10 text-center">
          <button onClick={loadMore} className="btn btn-ghost">
            {loadMoreLabel}
          </button>
        </div>
      )}
      {failed && (
        <div className="mt-8 text-center">
          <button onClick={loadMore} className="btn btn-ghost">
            Couldn&apos;t load more. Retry
          </button>
        </div>
      )}
      {!hasMore && items.length > 30 && <p className="mt-12 text-center text-xs text-muted">You&apos;ve reached the end</p>}
    </>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-6 py-20 text-center">
      <SearchX className="mx-auto h-6 w-6 text-muted" />
      <h2 className="mt-3 text-sm font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted">{text}</p>
      {action && (
        <button onClick={action.onClick} className="btn btn-ghost mt-5">
          {action.label}
        </button>
      )}
    </div>
  );
}
