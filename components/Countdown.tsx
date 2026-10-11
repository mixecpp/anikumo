"use client";

import { useEffect, useState } from "react";

export function formatCountdown(ms: number) {
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

/** Live "in 3d 4h" countdown that renders a stable placeholder on the server. */
export default function Countdown({ to, prefix = "in ", fallback = "" }: { to: number; prefix?: string; fallback?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <>{fallback}</>;
  const ms = to - now;
  return <>{ms > 0 ? `${prefix}${formatCountdown(ms)}` : fallback || "Out now"}</>;
}
