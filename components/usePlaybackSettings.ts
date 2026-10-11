"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeSettings, settingsPatch, type PlaybackSettings } from "@/lib/playback/settings";

export function usePlaybackSettings(initial: PlaybackSettings, userId: string | null) {
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const pending = useRef<Partial<PlaybackSettings>>({});
  const request = useRef<Promise<void> | null>(null);
  const storageKey = userId ? `aw_player_settings:${userId}` : "aw_player_settings:guest";
  const pendingKey = userId ? `aw_player_settings_pending:${userId}` : null;

  const persistPending = useCallback(() => {
    if (!pendingKey) return;
    try {
      if (Object.keys(pending.current).length) localStorage.setItem(pendingKey, JSON.stringify(pending.current));
      else localStorage.removeItem(pendingKey);
    } catch {}
  }, [pendingKey]);

  const flush = useCallback(() => {
    if (!userId || request.current || !Object.keys(pending.current).length) return;
    setStatus("saving");
    const write = async () => {
      while (Object.keys(pending.current).length) {
        const data = pending.current;
        pending.current = {};
        try {
          const r = await fetch("/api/player/settings", { method: "PATCH", headers: { "Content-Type": "application/json", "X-Account-Id": userId }, body: JSON.stringify(data), keepalive: true });
          if (!r.ok) throw new Error("Could not save settings");
        } catch {
          pending.current = { ...data, ...pending.current }; persistPending(); setStatus("error"); return;
        }
        persistPending();
      }
      setStatus("saved");
    };
    request.current = write().finally(() => { request.current = null; });
  }, [userId, persistPending]);

  const update = useCallback((patch: Partial<PlaybackSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
    if (!userId) return;
    Object.assign(pending.current, patch); persistPending(); flush();
  }, [storageKey, userId, persistPending, flush]);

  useEffect(() => {
    if (!userId) {
      try { const raw = localStorage.getItem(storageKey); if (raw) setSettings(normalizeSettings(JSON.parse(raw))); } catch {}
    } else if (pendingKey) {
      try {
        const raw = localStorage.getItem(pendingKey);
        if (raw) { const patch = settingsPatch(JSON.parse(raw)); setSettings((current) => ({ ...current, ...patch })); pending.current = patch; flush(); }
      } catch {}
    }
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [userId, storageKey, pendingKey, flush]);

  return { settings, update, status };
}
