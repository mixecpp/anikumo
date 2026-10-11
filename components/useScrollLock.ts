"use client";

import { useEffect } from "react";

let locks = 0;

/** Stops the page behind a modal or bottom sheet from scrolling (incl. iOS rubber-banding). Nest-safe. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (locks++ === 0) {
      root.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--locks === 0) {
        root.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
  }, [active]);
}
