"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/lib/toast";

/** While a rewatch is active, finishing an episode (per the player's progress events) advances it. */
export default function RewatchTracker({ anilistId, active }: { anilistId: number; active: boolean }) {
  const sent = useRef(new Set<number>());
  useEffect(() => {
    if (!active) return;
    const onProgress = async (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d?.anilistId !== anilistId || d.completed !== true || !Number.isSafeInteger(d.episode) || sent.current.has(d.episode)) return;
      sent.current.add(d.episode);
      const res = await fetch("/api/list/rewatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anilistId, episode: d.episode }) });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.entry && !j.entry.rewatching) toast("Rewatch complete 🎉");
    };
    window.addEventListener("anikumo:progress", onProgress);
    return () => window.removeEventListener("anikumo:progress", onProgress);
  }, [anilistId, active]);
  return null;
}
