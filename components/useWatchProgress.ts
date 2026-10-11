"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Identity = { userId: string | null; anilistId: number; episode: number; title: string; coverImage: string; completed: boolean };
type Sample = { progressSeconds: number; durationSeconds: number; sampledAt: number };
type ProgressResult = { completed: boolean; progressSeconds?: number; durationSeconds?: number; sampledAt?: number };

function publishProgress(identity: { anilistId: number; episode: number }, result: ProgressResult, sample?: Partial<Sample> | null) {
  const duration = result.durationSeconds ?? sample?.durationSeconds ?? 0;
  const position = result.progressSeconds ?? sample?.progressSeconds ?? 0;
  window.dispatchEvent(new CustomEvent("anikumo:progress", { detail: { anilistId: identity.anilistId, episode: identity.episode, completed: result.completed === true, pct: duration > 0 ? Math.min(100, Math.max(0, Math.round(position / duration * 100))) : 0 } }));
}

export function useWatchProgress(identity: Identity) {
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [watched, setWatched] = useState(identity.completed);
  const latest = useRef<Sample | null>(null);
  const lastWrite = useRef(0);
  const completedRef = useRef(identity.completed);
  const pendingCompletion = useRef<{ value: boolean } | null>(null);
  const lastIssuedAt = useRef(0);
  const issued = useRef(0);
  const queueKey = identity.userId ? `aw_pending_progress:${identity.userId}:${identity.anilistId}:${identity.episode}` : null;
  const mounted = useRef(true);

  const save = useCallback(async (final = false) => {
    const intent = pendingCompletion.current;
    if (!identity.userId || !queueKey || (!latest.current && !intent)) return false;
    const requestNumber = ++issued.current;
    const sample = latest.current;
    const payload = {
      anilistId: identity.anilistId, episode: identity.episode, title: identity.title, coverImage: identity.coverImage,
      expectedUserId: identity.userId,
      ...(sample ? { progressSeconds: sample.progressSeconds, durationSeconds: sample.durationSeconds } : {}),
      sampledAt: intent ? Math.max(Date.now(), (sample?.sampledAt ?? 0) + 1, lastIssuedAt.current + 1) : sample?.sampledAt ?? Date.now(),
      ...(intent ? { completed: intent.value } : {}),
    };
    lastIssuedAt.current = Math.max(lastIssuedAt.current, payload.sampledAt);
    const body = JSON.stringify(payload);
    try { localStorage.setItem(queueKey, body); } catch {}
    lastWrite.current = Date.now();
    // Keep the local retry until a normal request confirms a durable write.
    if (final && navigator.sendBeacon?.("/api/progress", new Blob([body], { type: "application/json" }))) return true;
    if (mounted.current) setSaved("saving");
    try {
      const r = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
      if (!r.ok) throw new Error("Progress save failed");
      const result: ProgressResult = await r.json();
      if (typeof result.sampledAt === "number" && Number.isSafeInteger(result.sampledAt)) lastIssuedAt.current = Math.max(lastIssuedAt.current, result.sampledAt);
      if (intent && result.completed !== intent.value) throw new Error("Watch status was not saved");
      try { if (localStorage.getItem(queueKey) === body) localStorage.removeItem(queueKey); } catch {}
      if (requestNumber === issued.current) {
        completedRef.current = result.completed === true;
        if (pendingCompletion.current === intent) pendingCompletion.current = null;
        if (mounted.current) { setSaved("saved"); setWatched(completedRef.current); publishProgress({ anilistId: identity.anilistId, episode: identity.episode }, result, sample); }
      }
      return true;
    } catch { if (mounted.current && requestNumber === issued.current) setSaved("error"); return false; }
  }, [identity.userId, identity.anilistId, identity.episode, identity.title, identity.coverImage, queueKey]);

  const sample = useCallback((current: number, duration: number) => {
    if (!Number.isFinite(current) || !Number.isFinite(duration) || duration <= 0 || current < 0) return;
    latest.current = { progressSeconds: Math.min(current, duration), durationSeconds: duration, sampledAt: Date.now() };
    if (current >= 5 && Date.now() - lastWrite.current >= 10_000) void save();
  }, [save]);

  const setCompletion = useCallback((completed: boolean) => {
    completedRef.current = completed;
    pendingCompletion.current = { value: completed };
    return save();
  }, [save]);
  const markWatched = useCallback(() => setCompletion(true), [setCompletion]);
  const toggleWatched = useCallback(() => setCompletion(!completedRef.current), [setCompletion]);

  useEffect(() => {
    mounted.current = true;
    const retry = async () => {
      if (!queueKey) return;
      const prefix = `aw_pending_progress:${identity.userId}:`;
      const queued: { key: string; body: string }[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith(prefix)) { const body = localStorage.getItem(key); if (body) queued.push({ key, body }); } }
      } catch {}
      for (const { key, body } of queued) {
        try {
          if (localStorage.getItem(key) !== body) continue;
          const payload = JSON.parse(body);
          const current = key === queueKey;
          const requestNumber = current ? ++issued.current : 0;
          if (current && typeof payload.completed === "boolean" && !pendingCompletion.current) {
            pendingCompletion.current = { value: payload.completed };
            completedRef.current = payload.completed;
          }
          const intent = pendingCompletion.current;
          const r = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body });
          if (!r.ok) continue;
          const result: ProgressResult = await r.json();
          if (localStorage.getItem(key) !== body) continue;
          localStorage.removeItem(key);
          if (current && requestNumber === issued.current) {
            if (typeof result.sampledAt === "number" && Number.isSafeInteger(result.sampledAt)) lastIssuedAt.current = Math.max(lastIssuedAt.current, result.sampledAt);
            completedRef.current = result.completed === true;
            if (pendingCompletion.current === intent) pendingCompletion.current = null;
            if (mounted.current) { setWatched(completedRef.current); setSaved("saved"); publishProgress(payload, result, payload); }
          } else if (!current && mounted.current) publishProgress(payload, result, payload);
        } catch {}
      }
    };
    void retry();
    const onHide = () => { if (document.visibilityState === "hidden") void save(true); };
    const onExit = () => { void save(true); };
    window.addEventListener("online", retry);
    window.addEventListener("pagehide", onExit);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", retry);
      window.removeEventListener("pagehide", onExit);
      document.removeEventListener("visibilitychange", onHide);
      void save(true);
    };
  }, [save, queueKey, identity.userId]);

  return { saved, watched, sample, save, markWatched, toggleWatched, latest };
}
