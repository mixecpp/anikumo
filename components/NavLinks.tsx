"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { isActive, type MenuEntry } from "@/lib/nav";
import { useT } from "./PrefsProvider";

/**
 * Desktop top bar links. Plain links for single pages; "Browse" and "Community" open a small
 * menu (on hover or click) so related pages share one spot instead of crowding the bar.
 */
export default function NavLinks({ menu }: { menu: MenuEntry[] }) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Close on navigation, outside clicks and Escape.
  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hover = (key: string | null) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (key) setOpen(key);
    else closeTimer.current = setTimeout(() => setOpen(null), 160);
  };

  return (
    <div ref={root} className="hidden items-center gap-1 lg:flex">
      {menu.map((entry) => {
        const active = entry.items ? entry.items.some((i) => isActive(pathname, i.href)) : isActive(pathname, entry.href);
        const pill = active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/[0.08]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />;
        const cls = `relative flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${active || open === entry.href ? "text-fg" : "text-muted hover:text-fg"}`;

        if (!entry.items)
          return (
            <Link key={entry.href} href={entry.href} aria-current={active ? "page" : undefined} className={cls}>
              {pill}
              <span className="relative">{t(entry.label)}</span>
            </Link>
          );

        const isOpen = open === entry.href;
        return (
          <div key={entry.href} className="relative" onPointerEnter={(e) => e.pointerType === "mouse" && hover(entry.href)} onPointerLeave={(e) => e.pointerType === "mouse" && hover(null)}>
            <button type="button" onClick={() => setOpen(isOpen ? null : entry.href)} aria-expanded={isOpen} aria-haspopup="true" className={cls}>
              {pill}
              <span className="relative">{t(entry.label)}</span>
              <ChevronDown className={`relative h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  // pt-1.5 bridges the gap so the menu doesn't close while the mouse moves down to it.
                  className="absolute left-0 top-full z-50 pt-1.5"
                >
                  <div role="menu" className="min-w-44 rounded-lg border border-line bg-panel py-1 shadow-lg shadow-black/30">
                    {entry.items.map((item) => {
                      const here = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          aria-current={here ? "page" : undefined}
                          className={`block px-3.5 py-1.5 text-sm transition-colors hover:bg-white/[0.04] hover:text-fg ${here ? "text-fg" : "text-muted"}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
