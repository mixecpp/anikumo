"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useScrollLock } from "./useScrollLock";

/** Official YouTube trailer in a lightbox. Pass null to close. */
export default function TrailerModal({ trailer, onClose }: { trailer: { id: string; title: string } | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useScrollLock(!!trailer);

  useEffect(() => {
    if (!trailer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [trailer, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {trailer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-label={`${trailer.title} trailer`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4 text-[#fff]">
              <span className="truncate text-sm font-medium">{trailer.title}</span>
              <button onClick={onClose} className="press flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[#fff]/70 hover:text-[#fff]" aria-label="Close trailer">
                <X className="h-4 w-4" /> Close
              </button>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.id)}?autoplay=1&rel=0`}
                title={`${trailer.title} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
