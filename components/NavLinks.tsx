"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Clapperboard, Medal, Search } from "lucide-react";
import { isActive, type MenuEntry, type MenuItem } from "@/lib/nav";
import { useT } from "./PrefsProvider";
import NavIcon from "./NavIcon";

function ItemIcon({ icon }: { icon: MenuItem["icon"] }) {
  const cls = "h-4 w-4";
  if (icon === "trailers") return <Clapperboard className={cls} aria-hidden />;
  if (icon === "leaderboard") return <Medal className={cls} aria-hidden />;
  if (icon === "all") return <Search className={cls} aria-hidden />;
  return <NavIcon name={icon} className={cls} />;
}

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
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  // pt-2 bridges the gap so the menu doesn't close while the mouse moves down to it.
                  className="absolute left-0 top-full z-50 pt-2"
                >
                  <div role="menu" className="glass-strong w-72 rounded-2xl p-1.5 shadow-2xl shadow-black/40">
                    {entry.items.map((item) => {
                      const here = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          aria-current={here ? "page" : undefined}
                          className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${here ? "bg-white/[0.07]" : "hover:bg-white/[0.05]"}`}
                        >
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${here ? "border-accent/40 bg-accent/15 text-accent" : "border-white/[0.07] bg-white/[0.03] text-muted group-hover:text-fg"}`}>
                            <ItemIcon icon={item.icon} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm text-fg">{item.label}</span>
                            <span className="block truncate text-xs text-muted">{item.hint}</span>
                          </span>
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
