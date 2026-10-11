"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

type Tag = { name: string; category: string; description: string };

let tagCache: Promise<Tag[]> | null = null;
function loadTags() {
  tagCache ??= fetch("/api/tags")
    .then((r) => r.json())
    .then((j) => (j.tags ?? []) as Tag[])
    .catch(() => []);
  return tagCache;
}

/** Autocomplete for AniList tags. `tone` styles chips as included or excluded. */
export default function TagPicker({ value, onChange, tone, placeholder, exclude = [] }: { value: string[]; onChange: (v: string[]) => void; tone: "include" | "exclude"; placeholder: string; exclude?: string[] }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !tags.length) loadTags().then(setTags);
  }, [open, tags.length]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tags.filter((t) => !value.includes(t.name) && !exclude.includes(t.name) && (!s || t.name.toLowerCase().includes(s))).slice(0, 8);
  }, [tags, q, value, exclude]);

  const add = (name: string) => {
    if (value.length >= 8) return;
    onChange([...value, name]);
    setQ("");
    setActive(0);
  };

  return (
    <div ref={ref} className="relative">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <button
              key={t}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className={`press group flex items-center gap-1 rounded-full py-1 pl-3 pr-2 text-xs ${tone === "include" ? "bg-fg text-bg" : "bg-red-500/15 text-red-300 line-through decoration-red-300/60"}`}
            >
              {t}
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(matches.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && matches[active]) {
              e.preventDefault();
              add(matches[active].name);
            } else if (e.key === "Escape") setOpen(false);
            else if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
          }}
          placeholder={placeholder}
          className="input !py-1.5 !pl-8 text-xs"
          aria-label={placeholder}
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="glass-strong absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl p-1" role="listbox">
          {matches.map((t, i) => (
            <li
              key={t.name}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(t.name)}
              title={t.description}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs ${i === active ? "bg-white/[0.08]" : ""}`}
            >
              <div>{t.name}</div>
              <div className="text-[10px] text-muted">{t.category}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
