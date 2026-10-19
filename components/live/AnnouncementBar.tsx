"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Megaphone, X } from "lucide-react";
import { useLive } from "./LiveProvider";

const KEY = "ak_announcement_dismissed";
const FULLSCREEN_SHOW_MS = 12_000;

/** The element in fullscreen, if it is one we can draw into (not a video or an iframe). */
function useFullscreenHost() {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const on = () => {
      const el = document.fullscreenElement;
      setHost(el && el.tagName !== "IFRAME" && el.tagName !== "VIDEO" ? el : null);
    };
    on();
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  return host;
}

/**
 * Site-wide announcements from the admins, across the top of every page. When an episode is
 * fullscreen it is drawn inside the fullscreen player (anything else would be hidden behind it),
 * and tucks itself away after a few seconds so it does not sit on top of the video.
 */
export default function AnnouncementBar() {
  const { announcement } = useLive();
  const host = useFullscreenHost();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hiddenInFullscreen, setHiddenInFullscreen] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(KEY));
    } catch {}
  }, []);

  const id = announcement?.id ?? null;
  useEffect(() => {
    if (!host || !id) return;
    setHiddenInFullscreen(null);
    const t = setTimeout(() => setHiddenInFullscreen(id), FULLSCREEN_SHOW_MS);
    return () => clearTimeout(t);
  }, [host, id]);

  if (!mounted) return null;
  const show = !!announcement && dismissed !== announcement.id && !(host && hiddenInFullscreen === announcement.id);

  const dismiss = () => {
    if (!announcement) return;
    setDismissed(announcement.id);
    try {
      localStorage.setItem(KEY, announcement.id);
    } catch {}
  };

  const important = announcement?.tone === "important";
  const external = !!announcement?.href && !announcement.href.startsWith("/");
  const linkCls = "flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/[0.14]";

  return createPortal(
    <AnimatePresence>
      {show && announcement && (
        <motion.div
          key={announcement.id}
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[95] w-[min(640px,calc(100vw-1.5rem))] -translate-x-1/2"
        >
          <div
            className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm text-fg shadow-2xl shadow-black/40 backdrop-blur-xl ${
              important ? "border-accent/40 bg-[color-mix(in_srgb,var(--accent)_14%,var(--panel))]" : "border-line bg-panel/95"
            }`}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${important ? "bg-accent/20 text-accent" : "bg-white/[0.06] text-fg/80"}`}>
              <Megaphone className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 leading-snug">
              <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Announcement</span>
              {announcement.body}
            </p>
            {announcement.href &&
              (external ? (
                <a href={announcement.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                  Open <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <Link href={announcement.href} className={linkCls} onClick={dismiss}>
                  Open <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            <button onClick={dismiss} className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Dismiss announcement">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    host ?? document.body,
  );
}
