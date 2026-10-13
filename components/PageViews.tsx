"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Counts a page view on every page change (anonymous daily totals for the admin overview —
 * see lib/traffic.ts). Respects "Do Not Track" and Global Privacy Control.
 */
export default function PageViews() {
  const path = usePathname();
  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
    const body = JSON.stringify({ path });
    try {
      if (!navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" }))) throw new Error();
    } catch {
      fetch("/api/hit", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  }, [path]);
  return null;
}
