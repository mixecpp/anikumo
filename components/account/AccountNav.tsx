"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useEdgeFade } from "../useEdgeFade";
import { motion } from "motion/react";
import { BarChart3, Heart, History, LayoutGrid, ListChecks, ListPlus, Settings } from "lucide-react";
import { useT } from "../PrefsProvider";
import type { MessageKey } from "@/lib/i18n";
import { isActive } from "@/lib/nav";

const TABS: { href: string; label: MessageKey; icon: typeof LayoutGrid }[] = [
  { href: "/account", label: "menu.overview", icon: LayoutGrid },
  { href: "/account/list", label: "menu.list", icon: ListChecks },
  { href: "/account/history", label: "menu.history", icon: History },
  { href: "/account/favorites", label: "menu.favorites", icon: Heart },
  { href: "/account/lists", label: "menu.lists", icon: ListPlus },
  { href: "/account/stats", label: "menu.stats", icon: BarChart3 },
  { href: "/account/settings", label: "menu.settings", icon: Settings },
];

export default function AccountNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  useEdgeFade(navRef, [pathname]);
  const t = useT();
  return (
    <nav ref={navRef} aria-label="Account" className="scrollbar-none mt-8 -mx-4 flex gap-0.5 overflow-x-auto border-b border-white/[0.06] px-4 sm:mx-0 sm:gap-1 sm:px-0">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/account" ? pathname === href : isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex shrink-0 items-center gap-1.5 px-2.5 pb-3 pt-1 text-sm sm:gap-2 sm:px-3 transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            <Icon className="h-4 w-4" />
            {t(label)}
            {active && <motion.span layoutId="account-tab" className="absolute inset-x-0 -bottom-px h-px bg-fg" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </Link>
        );
      })}
    </nav>
  );
}
