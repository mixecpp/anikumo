"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { dismiss, toastStore } from "@/lib/toast";

const EMPTY: never[] = [];

export default function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get, () => EMPTY);
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 lg:bottom-6" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CircleCheck : t.tone === "error" ? CircleAlert : Info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-strong pointer-events-auto relative flex items-center gap-2.5 overflow-hidden rounded-xl px-3.5 py-2.5 text-sm"
              role={t.tone === "error" ? "alert" : "status"}
            >
              <Icon className={`h-4 w-4 shrink-0 ${t.tone === "error" ? "text-red-400" : t.tone === "success" ? "text-success" : "text-muted"}`} />
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button onClick={t.action.onClick} className="rounded-md px-2 py-0.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10">
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-muted hover:text-fg" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
              {t.action && (
                <motion.span
                  className="absolute bottom-0 left-0 h-0.5 bg-accent/60"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: t.duration / 1000, ease: "linear" }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
