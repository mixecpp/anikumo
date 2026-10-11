"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Clapperboard,
  Compass,
  CornerDownLeft,
  Dices,
  GitCompare,
  Heart,
  History,
  House,
  LayoutGrid,
  ListChecks,
  ListPlus,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { readRecent } from "@/lib/recent";
import { toast } from "@/lib/toast";
import { usePrefs, useT } from "./PrefsProvider";
import { useScrollLock } from "./useScrollLock";

type Item = { id: string; label: string; hint?: string; icon?: LucideIcon; image?: string; group: string; run: () => void | Promise<void> };
type SearchHit = { id: number; title: string; cover: string; year: number | null; format: string | null };

export default function CommandPalette() {
  const router = useRouter();
  const t = useT();
  const { loggedIn, prefs } = usePrefs();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  useScrollLock(open);
  const listRef = useRef<HTMLDivElement>(null);
  const paletteKey = prefs.shortcuts.palette;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === paletteKey) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("anikumo:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("anikumo:palette", onOpen);
    };
  }, [paletteKey]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
    }
    setActive(0);
  }, [open]);

  useEffect(() => {
    setActive(0);
    if (q.trim().length < 2) return setHits([]);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setHits((j.results ?? []).slice(0, 6)))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const go = (href: string) => () => router.push(href);

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = [
      { id: "p-home", label: t("nav.home"), icon: House, group: "Pages", run: go("/") },
      { id: "p-browse", label: t("nav.browse"), icon: Compass, group: "Pages", run: go("/browse") },
      { id: "p-season", label: t("nav.season"), icon: LayoutGrid, group: "Pages", run: go("/season") },
      { id: "p-schedule", label: t("nav.schedule"), icon: CalendarDays, group: "Pages", run: go("/schedule") },
      { id: "p-charts", label: t("nav.charts"), icon: Trophy, group: "Pages", run: go("/charts") },
      { id: "p-trailers", label: "Trailers", icon: Clapperboard, group: "Pages", run: go("/trailers") },
      { id: "p-compare", label: "Compare shows", icon: GitCompare, group: "Pages", run: go("/compare") },
      ...(loggedIn
        ? [
            { id: "p-list", label: t("menu.list"), icon: ListChecks, group: "Pages", run: go("/account/list") },
            { id: "p-history", label: t("menu.history"), icon: History, group: "Pages", run: go("/account/history") },
            { id: "p-favorites", label: t("menu.favorites"), icon: Heart, group: "Pages", run: go("/account/favorites") },
            { id: "p-stats", label: t("menu.stats"), icon: BarChart3, group: "Pages", run: go("/account/stats") },
            { id: "p-lists", label: t("menu.lists"), icon: ListPlus, group: "Pages", run: go("/account/lists") },
            { id: "p-notif", label: t("menu.notifications"), icon: Bell, group: "Pages", run: go("/notifications") },
            { id: "p-settings", label: t("menu.settings"), icon: Settings, group: "Pages", run: go("/account/settings") },
          ]
        : []),
    ];
    const actions: Item[] = [
      {
        id: "a-surprise",
        label: t("common.surprise"),
        hint: "Random show",
        icon: Dices,
        group: "Actions",
        run: async () => {
          const res = await fetch("/api/surprise?score=70");
          const j = await res.json();
          if (j.id) router.push(`/anime/${j.id}`);
          else toast("Couldn't pick something", "error");
        },
      },
      {
        id: "a-theme",
        label: prefs.theme === "light" ? "Switch to dark theme" : "Switch to light theme",
        icon: prefs.theme === "light" ? Moon : Sun,
        group: "Actions",
        run: async () => {
          await fetch("/api/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: prefs.theme === "light" ? "dark" : "light" }) });
          router.refresh();
        },
      },
      ...(loggedIn
        ? [
            {
              id: "a-logout",
              label: t("menu.logout"),
              icon: LogOut,
              group: "Actions",
              run: async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/");
                router.refresh();
              },
            },
          ]
        : []),
    ];
    const recent: Item[] = q.trim()
      ? []
      : readRecent()
          .slice(0, 5)
          .map((r) => ({ id: `r-${r.id}`, label: r.title, image: r.cover, group: t("search.recent"), run: go(`/anime/${r.id}`) }));
    const anime: Item[] = hits.map((h) => ({
      id: `s-${h.id}`,
      label: h.title,
      hint: [h.format, h.year].filter(Boolean).join(" · "),
      image: h.cover,
      group: "Anime",
      run: go(`/anime/${h.id}`),
    }));
    const needle = q.trim().toLowerCase();
    const filter = (list: Item[]) => (needle ? list.filter((i) => i.label.toLowerCase().includes(needle)) : list);
    const searchAll: Item[] = needle.length >= 2 ? [{ id: "s-all", label: `Search “${q.trim()}” in browse`, icon: Search, group: "Anime", run: go(`/browse?q=${encodeURIComponent(q.trim())}`) }] : [];
    return [...anime, ...searchAll, ...recent, ...filter(pages), ...filter(actions)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, hits, loggedIn, prefs.theme, t, open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  async function runItem(i: number) {
    const item = items[i];
    if (!item) return;
    setOpen(false);
    await item.run();
  }

  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-xl overflow-hidden rounded-2xl"
            role="dialog"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(items.length - 1, a + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    runItem(active);
                  }
                }}
                placeholder={t("palette.placeholder")}
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                aria-label="Command"
              />
              <kbd className="rounded border border-white/10 px-1.5 font-mono text-[10px] text-muted">Esc</kbd>
            </div>
            <div ref={listRef} className="thin-scroll max-h-[min(60vh,440px)] overflow-y-auto p-1.5" role="listbox">
              {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">No matches</p>}
              {items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <div key={item.id}>
                    {header && <div className="label px-2.5 pb-1 pt-2.5">{header}</div>}
                    <button
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runItem(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${i === active ? "bg-white/[0.08] text-fg" : "text-fg/80"}`}
                    >
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" className="h-8 w-6 shrink-0 rounded object-cover" />
                      ) : Icon ? (
                        <Icon className="h-4 w-4 shrink-0 text-muted" />
                      ) : null}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="shrink-0 font-mono text-[11px] text-muted">{item.hint}</span>}
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
