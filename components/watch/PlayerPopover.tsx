"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { FloatingPortal, useDismiss, useFloating } from "../ui/Floating";
import { useScrollLock } from "../useScrollLock";

const PHONE = "(max-width: 767px)";

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/**
 * A panel opened from a button under the video: a bottom sheet on phones, a popover on desktop.
 *
 * It lives in a portal on purpose. Drawn inside the player, opening it (or focusing it) could
 * scroll the page on a phone, which pins the video to the top and clips everything under it,
 * so the menu looked like it closed the instant it opened.
 */
export default function PlayerPopover({
  open,
  onClose,
  anchor,
  title,
  width = 288,
  height = 440,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  title: string;
  width?: number;
  height?: number;
  children: ReactNode;
}) {
  const phone = usePhone();
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const id = useId();
  const style = useFloating(anchor, open && !phone, { align: "right", height, width, gap: 8 });

  // The backdrop counts as inside: it closes on its own click, so the tap can't fall through to the page.
  useDismiss(open, () => close(), [anchor, panel, backdrop]);
  useScrollLock(open && phone);

  const close = () => {
    if (panel.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true });
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open, phone]);

  const header = (
    <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2">
      <h2 id={`${id}-title`} className="text-sm font-semibold tracking-tight">
        {title}
      </h2>
      <button type="button" onClick={close} className="rounded-md p-1 text-muted transition-colors hover:bg-white/[0.07] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70" aria-label={`Close ${title.toLowerCase()}`}>
        <X className="h-4 w-4 md:h-3.5 md:w-3.5" />
      </button>
    </div>
  );

  return (
    <FloatingPortal>
      <AnimatePresence>
        {open && phone && (
          <div key="sheet" className="fixed inset-0 z-[70]">
            <motion.div ref={backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={close} />
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              tabIndex={-1}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-bg px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 text-sm outline-none"
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" aria-hidden="true" />
              {header}
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {open && !phone && style && (
        <div ref={panel} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1} style={{ ...style, width }} className="glass-strong overflow-y-auto rounded-xl p-3 text-sm shadow-xl outline-none">
          {header}
          {children}
        </div>
      )}
    </FloatingPortal>
  );
}
