"use client";

import { useEffect, type RefObject } from "react";

/**
 * For sideways-scrolling rows (tab bars, chip rows): fades whichever edge has more content, and
 * scrolls the selected item ([aria-current="page"]) into view so it's never hidden off-screen.
 */
export function useEdgeFade(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.dataset.fadeLeft = String(el.scrollLeft > 4);
      el.dataset.fadeRight = String(max - el.scrollLeft > 4);
    };
    const current = el.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"], [aria-selected="true"]');
    if (current) {
      const left = current.offsetLeft - (el.clientWidth - current.offsetWidth) / 2;
      el.scrollTo({ left: Math.max(0, left), behavior: "instant" as ScrollBehavior });
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
