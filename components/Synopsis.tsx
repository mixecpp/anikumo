"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 420;
  return (
    <div className="mt-5 max-w-3xl">
      <p className={`whitespace-pre-line text-sm leading-relaxed text-fg/80 md:text-[15px] ${!open && long ? "line-clamp-3" : ""}`}>{text}</p>
      {long && (
        <button onClick={() => setOpen((o) => !o)} className="press mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent-2 hover:underline">
          {open ? "Show less" : "Read more"}
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
