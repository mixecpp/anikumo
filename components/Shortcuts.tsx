"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { SHORTCUT_LABELS, type ShortcutAction } from "@/lib/prefs-shared";
import { usePrefs, useT } from "./PrefsProvider";

const ROUTES: Partial<Record<ShortcutAction, string>> = {
  goHome: "/",
  goBrowse: "/browse",
  goSchedule: "/schedule",
  goSeason: "/season",
  goAccount: "/account",
  goHistory: "/account/history",
  goFavorites: "/account/favorites",
  goList: "/account/list",
};

export function ShortcutsButton() {
  const t = useT();
  return (
    <button onClick={() => window.dispatchEvent(new Event("anikumo:shortcuts"))} className="hidden hover:text-fg lg:inline">
      {t("footer.shortcuts")} <kbd className="ml-1 rounded border border-white/10 px-1 font-mono text-[10px]">?</kbd>
    </button>
  );
}

function isTyping(t: EventTarget | null) {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t as HTMLElement | null)?.isContentEditable;
}

export default function Shortcuts() {
  const router = useRouter();
  const { prefs } = usePrefs();
  const [open, setOpen] = useState(false);
  const pendingG = useRef<number | null>(null);
  const keys = prefs.shortcuts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "Escape") return setOpen(false);
      const k = e.key.toLowerCase();
      if (k === keys.help) {
        e.preventDefault();
        return setOpen((o) => !o);
      }
      if (pendingG.current !== null) {
        const action = (Object.keys(ROUTES) as ShortcutAction[]).find((a) => keys[a] === k);
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        if (action) {
          e.preventDefault();
          setOpen(false);
          router.push(ROUTES[action]!);
        }
        return;
      }
      if (k === "g") pendingG.current = window.setTimeout(() => (pendingG.current = null), 900);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("anikumo:shortcuts", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("anikumo:shortcuts", onOpen);
    };
  }, [router, keys]);

  const rows: [string[], string][] = [
    [["/"], "Focus search"],
    [["Ctrl", keys.palette.toUpperCase()], "Command palette"],
    [[keys.help], SHORTCUT_LABELS.help],
    [["Esc"], "Close menus and dialogs"],
  ];
  const goRows: [string[], string][] = (Object.keys(ROUTES) as ShortcutAction[]).map((a) => [["G", keys[a].toUpperCase()], SHORTCUT_LABELS[a].replace("Go to ", "")]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-lg rounded-2xl p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-muted hover:text-fg" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                { title: "General", items: rows },
                { title: "Go to", items: goRows },
              ].map((g) => (
                <div key={g.title}>
                  <div className="label mb-2">{g.title}</div>
                  <ul className="space-y-1.5">
                    {g.items.map(([ks, l], i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-fg/80">{l}</span>
                        <span className="flex gap-1">
                          {ks.map((k) => (
                            <kbd key={k} className="min-w-6 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-center font-mono text-[11px] text-fg/80">
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted">Change these in Settings → Keyboard.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
