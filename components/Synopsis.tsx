"use client";

import { useState } from "react";

export default function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 420;
  return (
    <div className="mt-6 max-w-3xl">
      <p className={`whitespace-pre-line text-sm leading-relaxed text-fg/80 ${!open && long ? "line-clamp-3" : ""}`}>{text}</p>
      {long && (
        <button onClick={() => setOpen((o) => !o)} className="mt-1 text-sm font-medium text-accent hover:underline">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
