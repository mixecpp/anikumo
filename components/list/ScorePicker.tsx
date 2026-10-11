"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";

/** 1–10 rating as a row of compact segments; hover previews, click again to clear. */
export default function ScorePicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5" onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Your score">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 10`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(value === n ? null : n)}
            className={`h-6 w-4 rounded-[4px] transition-colors ${n <= shown ? "bg-star" : "bg-white/[0.08] hover:bg-white/[0.15]"}`}
          />
        ))}
      </div>
      <span className="flex min-w-14 items-center gap-1 font-mono text-sm tabular-nums">
        <Star className={`h-3.5 w-3.5 ${shown ? "fill-star text-star" : "text-muted"}`} />
        {shown ? shown : "—"}
        {value !== null && hover === null && (
          <button type="button" onClick={() => onChange(null)} className="ml-0.5 rounded p-0.5 text-muted hover:text-fg" aria-label="Clear score">
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}
