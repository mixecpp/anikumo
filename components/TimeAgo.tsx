"use client";

import { ago } from "./posts/Posts";

/** "5m", "3h", "2d" — rendered in the browser so it's in the viewer's time. */
export default function TimeAgo({ iso, className = "" }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {ago(iso)}
    </time>
  );
}
