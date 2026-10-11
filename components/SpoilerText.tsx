"use client";

import { useState } from "react";

/** Renders text with `||spoiler||` segments blurred until clicked. */
export default function SpoilerText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\|\|[\s\S]+?\|\|)/g);
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((p, i) => (p.startsWith("||") && p.endsWith("||") && p.length > 4 ? <Spoiler key={i} text={p.slice(2, -2)} /> : <span key={i}>{p}</span>))}
    </p>
  );
}

function Spoiler({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShown((s) => !s)}
      className={`rounded px-0.5 transition-all ${shown ? "bg-white/[0.06]" : "bg-white/[0.12] text-transparent blur-[4px] hover:blur-[3px]"}`}
      aria-label={shown ? "Hide spoiler" : "Show spoiler"}
      title={shown ? "Hide spoiler" : "Spoiler — click to reveal"}
    >
      {text}
    </button>
  );
}
