"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Flag } from "lucide-react";
import { toast } from "@/lib/toast";
import type { ReportableType } from "@/lib/reports";

const REASONS = [
  ["spoiler", "Unmarked spoiler"],
  ["harassment", "Harassment"],
  ["spam", "Spam"],
  ["offensive", "Offensive"],
  ["other", "Something else"],
] as const;

const MENU_W = 176;
const MENU_H = 232;

/**
 * Flag button with a "Report for…" menu. The menu is rendered at the top of the page (a portal)
 * and positioned next to the button, so containers with overflow hidden (collapsing threads,
 * cards, the comments sheet) can never clip it. It opens upwards when there's no room below.
 */
export default function ReportButton({ targetType, targetId, className = "" }: { targetType: ReportableType; targetId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const up = r.bottom + 4 + MENU_H > window.innerHeight && r.top - 4 - MENU_H > 0;
    setPos({
      top: up ? r.top - 4 - MENU_H : r.bottom + 4,
      left: Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8),
      up,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    // A fixed menu would drift away from its button, so close it on scroll or resize.
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function report(reason: string) {
    setOpen(false);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason }) });
    const json = await res.json().catch(() => ({}));
    toast(res.ok ? "Thanks — a moderator will take a look" : json.error ?? "Couldn't report", res.ok ? "success" : "error");
  }

  return (
    <div className={`relative ${className}`}>
      <button ref={button} onClick={() => setOpen((o) => !o)} className="rounded p-1 text-muted hover:text-fg" aria-label="Report" title="Report" aria-haspopup="menu" aria-expanded={open}>
        <Flag className="h-3.5 w-3.5" />
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menu}
                role="menu"
                initial={{ opacity: 0, y: pos.up ? 4 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: pos.up ? 4 : -4 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_W }}
                className="glass-strong z-[70] rounded-xl p-1"
              >
                <div className="label px-2 py-1">Report for</div>
                {REASONS.map(([k, l]) => (
                  <button key={k} role="menuitem" onClick={() => report(k)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-fg/85 hover:bg-white/[0.07]">
                    {l}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
