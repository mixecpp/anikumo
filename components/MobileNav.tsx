"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navLinks } from "@/lib/nav";
import NavIcon from "./NavIcon";
import { useT } from "./PrefsProvider";
import { Avatar } from "./UserMenu";
import { NewDot, useChangelogUnseen } from "./WhatsNew";

type U = { username: string; avatarColor: string; avatar: string };

/** Bottom tab bar on phones and tablets. The Account tab doubles as the profile button (no top-right menu there). */
export default function MobileNav({ libraryEnabled, user, latestChangelog }: { libraryEnabled: boolean; user: U | null; latestChangelog: string | null }) {
  const pathname = usePathname();
  const t = useT();
  const unseen = useChangelogUnseen(latestChangelog);
  const links = navLinks(libraryEnabled).filter((l) => l.icon !== "charts" && l.icon !== "library");
  const accountHref = user ? "/account" : "/login";
  const accountActive = isActive(pathname, "/account") || isActive(pathname, "/login") || isActive(pathname, "/register");
  const item = (active: boolean) => `press flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors ${active ? "text-fg" : "text-muted"}`;

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/[0.06] bg-bg/85 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 backdrop-blur-xl lg:hidden">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={item(active)}>
            <NavIcon name={l.icon} className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
            {t(l.label)}
          </Link>
        );
      })}
      <Link href={accountHref} aria-current={accountActive ? "page" : undefined} className={item(accountActive)}>
        <span className="relative">
          {user ? (
            <span className={`block rounded-full ring-offset-2 ring-offset-bg transition ${accountActive ? "ring-2 ring-fg" : ""}`}>
              <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} size={20} />
            </span>
          ) : (
            <NavIcon name="profile" className="h-5 w-5" strokeWidth={accountActive ? 2.2 : 1.7} />
          )}
          {unseen && <NewDot className="absolute -right-1 -top-0.5 !h-2 !w-2 ring-2 ring-bg" />}
        </span>
        {user ? t("nav.account") : t("menu.login")}
      </Link>
    </nav>
  );
}
