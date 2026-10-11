"use client";

import { useEffect } from "react";

/** Registers the offline/PWA service worker in production builds only (dev reloads would fight the cache). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
