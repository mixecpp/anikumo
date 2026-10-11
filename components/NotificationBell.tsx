"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, MessageCircle, Tv, UserPlus } from "lucide-react";
import { useT } from "./PrefsProvider";

type N = { id: string; type: string; title: string; body: string; href: string; image: string; readAt: string | null; createdAt: string };

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const ICON = { episode: Tv, reply: MessageCircle, follow: UserPlus } as Record<string, typeof Bell>;

export default function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<N[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setUnread(initialUnread), [initialUnread]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/notifications?sync=1")
      .then((r) => r.json())
      .then((j) => {
        setItems((j.notifications ?? []).slice(0, 8));
        setUnread(j.unread ?? 0);
      })
      .catch(() => setItems([]));
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markAll() {
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    router.refresh();
  }

  async function openItem(n: N) {
    setOpen(false);
    if (!n.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
    }
    if (n.href) router.push(n.href);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="press relative grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.07] hover:text-fg"
        aria-label={`${t("menu.notifications")}${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold text-bg"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="glass-strong absolute right-0 mt-2 w-[min(92vw,360px)] origin-top-right overflow-hidden rounded-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
              <span className="text-sm font-medium">{t("notif.title")}</span>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
                  <CheckCheck className="h-3.5 w-3.5" /> {t("notif.markAll")}
                </button>
              )}
            </div>
            <div className="thin-scroll max-h-[60dvh] overflow-y-auto overscroll-contain">
              {items === null ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-12 rounded-lg" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">{t("notif.empty")}</p>
              ) : (
                items.map((n) => {
                  const Icon = ICON[n.type] ?? Bell;
                  return (
                    <button key={n.id} onClick={() => openItem(n)} className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]">
                      {n.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.image} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06]">
                          <Icon className="h-4 w-4 text-muted" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm leading-snug ${n.readAt ? "text-fg/70" : "text-fg"}`}>{n.title}</span>
                        {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="font-mono text-[10px] text-muted">{ago(n.createdAt)}</span>
                        {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-white/[0.06] py-2.5 text-center text-xs text-muted hover:text-fg">
              View all
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
