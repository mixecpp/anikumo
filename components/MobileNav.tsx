"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navLinks } from "@/lib/nav";
import NavIcon from "./NavIcon";
import { useT } from "./PrefsProvider";

export default function MobileNav({ libraryEnabled }: { libraryEnabled: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const links = [...navLinks(libraryEnabled).filter((l) => l.icon !== "charts" && l.icon !== "library"), { href: "/account", label: "nav.account" as const, icon: "profile" as const }];
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/[0.06] bg-bg/85 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 backdrop-blur-xl lg:hidden">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`press flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors ${active ? "text-fg" : "text-muted"}`}
          >
            <NavIcon name={l.icon} className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
            {t(l.label)}
          </Link>
        );
      })}
    </nav>
  );
}
