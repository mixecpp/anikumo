"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Heart, History, LayoutGrid, ListChecks, ListPlus, LogIn, LogOut, Megaphone, Settings, Shield, UserPlus, UserRound, Globe } from "lucide-react";
import { toast } from "@/lib/toast";
import { useT } from "./PrefsProvider";
import type { MessageKey } from "@/lib/i18n";
import { NewDot, useChangelogUnseen } from "./WhatsNew";
import { avatarUrl } from "@/lib/avatars";

/** Profile picture, or the coloured initial when there isn't one. */
export function Avatar({ name, color, avatar, size = 32 }: { name: string; color: string; avatar?: string | null; size?: number }) {
  const src = avatarUrl(avatar);
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="shrink-0 rounded-full bg-white/[0.06] object-cover object-[center_15%]" style={{ width: size, height: size }} aria-hidden />
    );
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold uppercase text-[#fff]"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  );
}

const ACCOUNT_LINKS: { href: string; label: MessageKey; icon: typeof LayoutGrid }[] = [
  { href: "/account", label: "menu.overview", icon: LayoutGrid },
  { href: "/account/list", label: "menu.list", icon: ListChecks },
  { href: "/account/history", label: "menu.history", icon: History },
  { href: "/account/favorites", label: "menu.favorites", icon: Heart },
  { href: "/account/lists", label: "menu.lists", icon: ListPlus },
  { href: "/account/stats", label: "menu.stats", icon: BarChart3 },
  { href: "/account/settings", label: "menu.settings", icon: Settings },
];

type U = { username: string; avatarColor: string; avatar: string; isAdmin: boolean; isModerator?: boolean; profilePublic: boolean };

export default function UserMenu({ user, latestChangelog }: { user: U | null; latestChangelog: string | null }) {
  const router = useRouter();
  const unseen = useChangelogUnseen(latestChangelog);
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    toast("Logged out", "info");
    router.push("/");
    router.refresh();
  }

  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg/85 transition-colors hover:bg-white/[0.07] hover:text-fg";

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} className="press relative flex items-center rounded-full" aria-label="Account menu" aria-expanded={open}>
        {user ? (
          <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-muted transition-colors hover:text-fg">
            <UserRound className="h-4 w-4" />
          </span>
        )}
        {unseen && <NewDot className="absolute -right-0.5 -top-0.5 !h-2 !w-2 ring-2 ring-bg" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="glass-strong absolute right-0 mt-2 w-60 origin-top-right rounded-xl p-1"
          >
            {user ? (
              <>
                <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-2.5 pb-2.5 pt-1.5">
                  <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} size={28} />
                  <div className="min-w-0 truncate text-sm font-medium">{user.username}</div>
                </div>
                <div className="border-b border-white/[0.06] py-1">
                  {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={() => setOpen(false)} className={item}>
                      <Icon className="h-4 w-4 text-muted" /> {t(label)}
                    </Link>
                  ))}
                  {user.profilePublic && (
                    <Link href={`/u/${user.username}`} onClick={() => setOpen(false)} className={item}>
                      <Globe className="h-4 w-4 text-muted" /> {t("menu.profile")}
                    </Link>
                  )}
                  {user.isAdmin ? (
                    <Link href="/admin" onClick={() => setOpen(false)} className={item}>
                      <Shield className="h-4 w-4 text-muted" /> {t("menu.admin")}
                    </Link>
                  ) : user.isModerator ? (
                    <Link href="/admin/moderation" onClick={() => setOpen(false)} className={item}>
                      <Shield className="h-4 w-4 text-muted" /> Moderation
                    </Link>
                  ) : null}
                </div>
                <div className="pt-1">
                  <WhatsNewItem unseen={unseen} className={item} onClick={() => setOpen(false)} />
                  <button onClick={logout} className={item}>
                    <LogOut className="h-4 w-4 text-muted" /> {t("menu.logout")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className={item}>
                  <LogIn className="h-4 w-4 text-muted" /> {t("menu.login")}
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className={item}>
                  <UserPlus className="h-4 w-4 text-muted" /> {t("menu.register")}
                </Link>
                <div className="mt-1 border-t border-white/[0.06] pt-1">
                  <WhatsNewItem unseen={unseen} className={item} onClick={() => setOpen(false)} />
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WhatsNewItem({ unseen, className, onClick }: { unseen: boolean; className: string; onClick: () => void }) {
  return (
    <Link href="/changelog" onClick={onClick} className={className}>
      <Megaphone className="h-4 w-4 text-muted" /> What&apos;s new
      {unseen && <NewDot className="ml-auto" />}
    </Link>
  );
}
