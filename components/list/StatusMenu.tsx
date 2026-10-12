"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { LIST_STATUSES, STATUS_DOT, STATUS_LABEL, type ListStatus } from "@/lib/list-shared";
import { FloatingPortal, useDismiss, useFloating } from "../ui/Floating";

/** "Add to list" / current-status button with a dropdown of statuses. */
export default function StatusMenu({
  status,
  onChange,
  onRemove,
  size = "md",
  align = "left",
}: {
  status: ListStatus | null;
  onChange: (s: ListStatus) => void;
  onRemove?: () => void;
  size?: "sm" | "md";
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const floating = useFloating(ref, open, { align, height: 260, width: 192 });
  useDismiss(open, () => setOpen(false), [ref, menu]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`btn ${status ? "btn-ghost" : size === "sm" ? "btn-ghost" : "btn-primary"} ${size === "sm" ? "!px-2.5 !py-1 !text-xs" : ""}`}
      >
        {status ? <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} /> : <Plus className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        {status ? STATUS_LABEL[status] : "Add to list"}
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <FloatingPortal>
      <AnimatePresence>
        {open && floating && (
          <motion.div
            ref={menu}
            role="menu"
            style={floating}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.13 }}
            className="glass-strong rounded-xl p-1"
          >
            {LIST_STATUSES.map((s) => (
              <button
                key={s}
                role="menuitemradio"
                aria-checked={status === s}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  if (s !== status) onChange(s);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-fg/85 transition-colors hover:bg-white/[0.07] hover:text-fg"
              >
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                <span className="flex-1">{STATUS_LABEL[s]}</span>
                {status === s && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            ))}
            {status && onRemove && (
              <button
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  onRemove();
                }}
                className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-white/[0.06] px-2.5 py-1.5 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove from list
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </FloatingPortal>
    </div>
  );
}
