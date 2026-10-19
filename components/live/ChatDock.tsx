"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessagesSquare, X } from "lucide-react";
import { useScrollLock } from "../useScrollLock";
import { useKeyboardInset } from "../useKeyboardInset";
import ChatPanel from "./ChatPanel";
import { useLive } from "./LiveProvider";

const WIDE = "(min-width: 1024px)";

function useWide() {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * Where the live chat lives on screen. Desktop: a launcher in the bottom-left corner that opens a
 * small window above it, so you can keep chatting while you browse or watch. Phones and tablets:
 * the Chat tab in the bottom bar opens it as a sheet.
 */
export default function ChatDock() {
  const live = useLive();
  const wide = useWide();
  const sheet = live.open && wide === false;
  useScrollLock(sheet);
  const keyboard = useKeyboardInset(sheet);

  if (wide === null) return null;
  return (
    <>
      {wide && <Launcher />}
      <AnimatePresence>
        {live.open &&
          (wide ? (
            <motion.section
              key="window"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              aria-label="Live chat"
              className="chat-window fixed left-6 z-[44] flex w-[380px] origin-bottom-left flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/50"
            >
              <ChatPanel onClose={() => live.setOpen(false)} />
            </motion.section>
          ) : (
            <div key="sheet" className="fixed inset-0 z-[60]">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={() => live.setOpen(false)} />
              <motion.section
                aria-label="Live chat"
                role="dialog"
                aria-modal="true"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                style={{ bottom: keyboard, height: keyboard ? `calc(100dvh - ${keyboard}px - 2.5rem)` : "88dvh" }}
                className="absolute inset-x-0 flex flex-col overflow-hidden rounded-t-2xl bg-bg pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,0.45)]"
              >
                <ChatPanel onClose={() => live.setOpen(false)} />
              </motion.section>
            </div>
          ))}
      </AnimatePresence>
    </>
  );
}

function Launcher() {
  const live = useLive();
  return (
    <button
      onClick={live.toggle}
      aria-expanded={live.open}
      aria-label={live.open ? "Close live chat" : "Open live chat"}
      className={`chat-launcher press fixed left-6 z-[44] flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] shadow-lg shadow-black/30 backdrop-blur-xl transition-colors ${
        live.open ? "border-white/15 bg-white/[0.1] text-fg" : "border-line bg-panel/90 text-fg/90 hover:bg-panel"
      }`}
    >
      <span className="relative">
        {live.open ? <X className="h-4 w-4" /> : <MessagesSquare className="h-4 w-4" />}
        {live.unread && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-panel" aria-label="New messages" />}
      </span>
      <span className="font-medium">Chat</span>
      {live.online > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {live.online.toLocaleString()}
        </span>
      )}
    </button>
  );
}
