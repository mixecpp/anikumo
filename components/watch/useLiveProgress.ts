"use client";

import { useEffect, useState } from "react";
import type { EpisodeProgress } from "../EpisodeGrid";

/** Episode progress that also updates live from the player's `anikumo:progress` events. */
export function useLiveProgress(anilistId: number, initial: EpisodeProgress) {
  const [progress, setProgress] = useState(initial);
  useEffect(() => setProgress(initial), [initial]);
  useEffect(() => {
    const onProgress = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d?.anilistId !== anilistId || !Number.isSafeInteger(d.episode)) return;
      setProgress((prev) => ({ ...prev, [d.episode]: { pct: Math.min(100, Math.max(0, d.pct)), completed: d.completed === true } }));
    };
    window.addEventListener("anikumo:progress", onProgress);
    return () => window.removeEventListener("anikumo:progress", onProgress);
  }, [anilistId]);
  return progress;
}
