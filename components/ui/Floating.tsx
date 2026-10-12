"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Dropdown menus rendered at the top of the page (a portal) and pinned next to their button.
 * Menus drawn inside the page get cut off by any container with overflow hidden or scrolling
 * (cards, settings panels, collapsing threads) and can slip under neighbouring cards; these can't.
 */

const MARGIN = 8;

/** Fixed position for a menu under (or, without room, above) `anchor`. Follows it on scroll/resize. */
export function useFloating(anchor: RefObject<HTMLElement | null>, open: boolean, opts: { align?: "left" | "right"; height: number; gap?: number; width?: number }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const { align = "left", height, gap = 6, width } = opts;

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    let frame = 0;
    const place = () => {
      frame = 0;
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const below = vh - r.bottom - gap - MARGIN;
      const above = r.top - gap - MARGIN;
      const up = below < Math.min(height, 220) && above > below;
      const next: CSSProperties = { position: "fixed", zIndex: 70, minWidth: width ? undefined : r.width, width, maxHeight: Math.max(140, up ? above : below) };
      if (up) next.bottom = vh - r.top + gap;
      else next.top = r.bottom + gap;
      const w = width ?? r.width;
      if (align === "right") next.right = Math.max(MARGIN, vw - r.right);
      else next.left = Math.max(MARGIN, Math.min(r.left, vw - w - MARGIN));
      next.transformOrigin = `${up ? "bottom" : "top"} ${align}`;
      setStyle(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [open, anchor, align, height, gap, width]);

  return style;
}

/** Closes on a press outside every given element, or Escape. */
export function useDismiss(open: boolean, close: () => void, refs: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!refs.some((r) => r.current?.contains(t))) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // refs are stable objects; close may change identity each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

export function FloatingPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
