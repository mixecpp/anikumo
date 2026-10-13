"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ExternalLink, LogOut, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { Avatar } from "../UserMenu";
import { NewDot, useChangelogUnseen } from "../WhatsNew";
import { useScrollLock } from "../useScrollLock";

type Item = { href: string; label: string; match?: (path: string, tab: string | null) => boolean };
type Group = { title?: string; items: Item[] };

const settings = (tab: string, label: string): Item => ({
  href: tab === "account" ? "/account/settings" : `/account/settings?tab=${tab}`,
  label,
  match: (path, t) => path === "/account/settings" && (t ?? "account") === tab,
});

function groups(year: number): Group[] {
  return [
    { items: [{ href: "/account", label: "Overview", match: (p) => p === "/account" }] },
    {
      title: "Library",
      items: [
        { href: "/account/list", label: "My list" },
        { href: "/account/history", label: "History" },
        { href: "/account/favorites", label: "Favourites" },
        { href: "/account/lists", label: "Custom lists" },
      ],
    },
    {
      title: "Insights",
      items: [
        { href: "/account/stats", label: "Stats" },
        { href: `/account/year/${year}`, label: `${year} in review`, match: (p) => p.startsWith("/account/year") },
      ],
    },
    {
      title: "Settings",
      items: [
        settings("account", "Account"),
        settings("privacy", "Privacy"),
        settings("preferences", "Preferences"),
        settings("notifications", "Notifications"),
        settings("security", "Security"),
        settings("data", "Import & data"),
      ],
    },
  ];
}

const isOn = (item: Item, path: string, tab: string | null) => (item.match ? item.match(path, tab) : path === item.href || path.startsWith(item.href + "/"));

type Props = {
  user: { username: string; avatarColor: string; avatar: string; since: string };
  staffLink: { href: string; label: string } | null;
  latestChangelog: string | null;
  children: React.ReactNode;
};

/**
 * The account area: one grouped menu (Library, Insights, Settings) instead of a long row of
 * tabs. Desktop shows it as a sidebar; phones get a "current page" button that opens it as a sheet.
 */
export default function AccountShell({ user, staffLink, latestChangelog, children }: Props) {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  const [sheet, setSheet] = useState(false);
  const all = groups(new Date().getFullYear());
  const current = all.flatMap((g) => g.items).find((i) => isOn(i, path, tab));
  useEffect(() => setSheet(false), [path, tab]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 md:px-8 lg:pt-10">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ProfileBlock user={user} />
            <Menu groups={all} path={path} tab={tab} />
            <Footer staffLink={staffLink} latestChangelog={latestChangelog} />
          </div>
        </aside>

        {/* Phones and tablets */}
        <div className="lg:hidden">
          <ProfileBlock user={user} />
          <button onClick={() => setSheet(true)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm" aria-haspopup="dialog">
            <span className="text-muted">
              Account <span className="mx-1 text-muted/60">/</span> <span className="text-fg">{current?.label ?? "Overview"}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
        </div>

        <main className="min-w-0 pt-6 lg:pt-0">{children}</main>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <Menu groups={all} path={path} tab={tab} />
        <Footer staffLink={staffLink} latestChangelog={latestChangelog} />
      </Sheet>
    </div>
  );
}

function ProfileBlock({ user }: { user: Props["user"] }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} size={44} />
      <div className="min-w-0">
        <div className="truncate font-semibold tracking-tight">{user.username}</div>
        <Link href={`/u/${user.username}`} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
          View profile <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function Menu({ groups, path, tab }: { groups: Group[]; path: string; tab: string | null }) {
  return (
    <nav aria-label="Account" className="mt-6 space-y-5">
      {groups.map((g, i) => (
        <div key={g.title ?? i}>
          {g.title && <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted/70">{g.title}</div>}
          <ul>
            {g.items.map((item) => {
              const on = isOn(item, path, tab);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${on ? "bg-white/[0.06] text-fg" : "text-muted hover:text-fg"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Footer({ staffLink, latestChangelog }: { staffLink: Props["staffLink"]; latestChangelog: string | null }) {
  const router = useRouter();
  const unseen = useChangelogUnseen(latestChangelog);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast("Logged out", "info");
    router.push("/");
    router.refresh();
  }
  const cls = "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-muted transition-colors hover:text-fg";
  return (
    <div className="mt-5 border-t border-line pt-4">
      <Link href="/changelog" className={cls}>
        What&apos;s new {unseen && <NewDot />}
      </Link>
      {staffLink && (
        <Link href={staffLink.href} className={cls}>
          {staffLink.label}
        </Link>
      )}
      <button onClick={logout} className={cls}>
        <LogOut className="h-3.5 w-3.5" /> Log out
      </button>
    </div>
  );
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useScrollLock(open);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Account menu"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-bg px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
          >
            <div className="flex items-center justify-between px-3">
              <span className="text-sm font-semibold">Account</span>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-fg" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="-mt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
