"use client";

import { useRef } from "react";
import { useEdgeFade } from "./useEdgeFade";

/** A sideways-scrolling row that fades its overflowing edges and keeps the selected item in view. */
export default function FadeRow({ className = "", children, watch }: { className?: string; children: React.ReactNode; watch?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEdgeFade(ref, [watch]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
