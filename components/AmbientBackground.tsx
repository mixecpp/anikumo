"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAmbientOverride } from "@/lib/ambient";

/** A faint, blurred wash of the current page's key art behind the top of the page. */
export default function AmbientBackground() {
  const { images } = useAmbientOverride();
  const src = images?.[0];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70svh] overflow-hidden">
      <AnimatePresence>
        {src && (
          <motion.img
            key={src}
            src={src}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl saturate-150"
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
