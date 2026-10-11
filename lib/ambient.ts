"use client";

import { useEffect, useSyncExternalStore } from "react";

type State = { images: string[] | null; tint: string | null };

let state: State = { images: null, tint: null };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export function useAmbientOverride() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Drop into any page to swap the site-wide background art for that page. */
export function SetAmbient({ images, tint }: { images: (string | null | undefined)[]; tint?: string | null }) {
  const key = images.filter(Boolean).join("|");
  useEffect(() => {
    const list = key ? key.split("|") : [];
    set({ images: list.length ? list : null, tint: tint ?? null });
    return () => set({ images: null, tint: null });
  }, [key, tint]);
  return null;
}
