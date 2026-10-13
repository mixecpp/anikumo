"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, MessageCircle, Settings, Trash2, Tv, UserPlus } from "lucide-react";
import { useT } from "./PrefsProvider";

type N = { id: string; type: string; title: string; body: string; href: string; image: string; readAt: string | null; createdAt: string };

const ICON = { episode: Tv, reply: MessageCircle, follow: UserPlus } as Record<string, typeof Bell>;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "episode", label: "Episodes" },
  { key: "social", label: "Social" },
];

function day(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function NotificationsView({ initial }: { initial: N[] }) {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState("all");

  const shown = useMemo(() => items.filter((n) => filter === "all" || (filter === "episode" ? n.type === "episode" : n.type !== "episode")), [items, filter]);
  const groups = useMemo(() => {
    const out: { label: string; items: N[] }[] = [];
    for (const n of shown) {
      const l = day(n.createdAt);
      const last = out[out.length - 1];
      if (last?.label === l) last.items.push(n);
      else out.push({ label: l, items: [n] });
    }
    return out;
  }, [shown]);
  const unread = items.filter((n) => !n.readAt).length;

  async function markAll() {
    setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    router.refresh();
  }
  async function clearRead() {
    setItems((list) => list.filter((n) => !n.readAt));
    await fetch("/api/notifications", { method: "DELETE" });
  }
  function open(n: N) {
    if (!n.readAt) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).then(() => router.refresh());
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white/[0.04] p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${filter === f.key ? "text-fg" : "text-muted hover:text-fg"}`}>
              {filter === f.key && <motion.span layoutId="notif-filter" className="absolute inset-0 rounded-lg bg-white/[0.09]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {unread > 0 && (
            <button onClick={markAll} className="btn btn-ghost !py-1.5 !text-xs">
              <CheckCheck className="h-3.5 w-3.5" /> {t("notif.markAll")}
            </button>
          )}
          {items.some((n) => n.readAt) && (
            <button onClick={clearRead} className="btn btn-ghost !py-1.5 !text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Clear read
            </button>
          )}
          <Link href="/account/settings?tab=notifications" className="btn btn-ghost btn-icon !h-8 !w-8" aria-label="Notification settings">
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
          <Bell className="mx-auto h-6 w-6 text-muted" />
          <p className="mt-3 text-sm text-muted">{t("notif.empty")}</p>
          <p className="mt-1 text-xs text-muted">Shows marked “Watching” on your list notify you when new episodes air.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="label mb-2">{g.label}</h2>
              <ul className="panel divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
                <AnimatePresence initial={false}>
                  {g.items.map((n) => {
                    const Icon = ICON[n.type] ?? Bell;
                    const inner = (
                      <>
                        {n.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={n.image} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06]">
                            <Icon className="h-4 w-4 text-muted" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm ${n.readAt ? "text-fg/70" : "font-medium text-fg"}`}>{n.title}</span>
                          {n.body && <span className="mt-0.5 block text-xs text-muted">{n.body}</span>}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="font-mono text-[11px] text-muted">{new Date(n.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                          {!n.readAt && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
                        </span>
                      </>
                    );
                    return (
                      <motion.li key={n.id} layout exit={{ opacity: 0, height: 0 }}>
                        {n.href ? (
                          <Link href={n.href} onClick={() => open(n)} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                            {inner}
                          </Link>
                        ) : (
                          <button onClick={() => open(n)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]">
                            {inner}
                          </button>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
