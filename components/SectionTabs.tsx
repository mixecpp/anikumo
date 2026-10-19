"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navMenu } from "@/lib/nav";

/**
 * Phones and tablets: the desktop top bar's "Browse" and "Community" menus, as a row of tabs at
 * the top of the pages they group (so Seasonal, Schedule, Charts… are one tap away). Desktop
 * already has the menus, so this hides there.
 */
export default function SectionTabs() {
  const pathname = usePathname();
  const group = navMenu(false).find((g) => g.items?.some((i) => isActive(pathname, i.href)));
  if (!group?.items) return null;
  return (
    <nav aria-label={group.href === "/browse" ? "Browse sections" : "Community sections"} className="scrollbar-none mx-auto flex max-w-[1400px] gap-1.5 overflow-x-auto px-4 pt-3 lg:hidden">
      {group.items.filter((item) => !item.action).map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${on ? "bg-fg text-bg" : "bg-white/[0.05] text-muted hover:text-fg"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
