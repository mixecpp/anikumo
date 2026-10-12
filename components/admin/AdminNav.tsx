"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useEdgeFade } from "../useEdgeFade";
import { motion } from "motion/react";
import { Activity, Megaphone, ShieldAlert, Server, Users } from "lucide-react";
import { isActive } from "@/lib/nav";

const TABS = [
  { href: "/admin", label: "Overview", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldAlert, mods: true },
  { href: "/admin/changelog", label: "Changelog", icon: Megaphone },
  { href: "/admin/system", label: "System", icon: Server },
];

export default function AdminNav({ modOnly = false }: { modOnly?: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  useEdgeFade(navRef, [pathname]);
  return (
    <nav ref={navRef} aria-label="Admin" className="scrollbar-none mt-6 -mx-4 flex gap-0.5 overflow-x-auto border-b border-white/[0.06] px-4 sm:mx-0 sm:gap-1 sm:px-0">
      {TABS.filter((t) => !modOnly || ("mods" in t && t.mods)).map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex shrink-0 items-center gap-1.5 px-2.5 pb-3 pt-1 text-sm sm:gap-2 sm:px-3 transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {active && <motion.span layoutId="admin-tab" className="absolute inset-x-0 -bottom-px h-px bg-fg" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </Link>
        );
      })}
    </nav>
  );
}
