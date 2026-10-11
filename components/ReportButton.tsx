"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flag } from "lucide-react";
import { toast } from "@/lib/toast";

const REASONS = [
  ["spoiler", "Unmarked spoiler"],
  ["harassment", "Harassment"],
  ["spam", "Spam"],
  ["offensive", "Offensive"],
  ["other", "Something else"],
] as const;

export default function ReportButton({ targetType, targetId }: { targetType: "comment" | "review"; targetId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function report(reason: string) {
    setOpen(false);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason }) });
    const json = await res.json().catch(() => ({}));
    toast(res.ok ? "Thanks — a moderator will take a look" : json.error ?? "Couldn't report", res.ok ? "success" : "error");
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded p-1 text-muted hover:text-fg" aria-label="Report" title="Report">
        <Flag className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }} className="glass-strong absolute right-0 z-40 mt-1 w-44 rounded-xl p-1">
            <div className="label px-2 py-1">Report for</div>
            {REASONS.map(([k, l]) => (
              <button key={k} onClick={() => report(k)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-fg/85 hover:bg-white/[0.07]">
                {l}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
