"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { isActive, type NavKey } from "@/lib/nav";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "./PrefsProvider";

export default function NavLinks({ links }: { links: { href: string; label: MessageKey; icon: NavKey }[] }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <div className="hidden items-center gap-1 lg:flex">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/[0.08]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{t(l.label)}</span>
          </Link>
        );
      })}
    </div>
  );
}
