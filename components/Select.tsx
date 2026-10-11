"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string };

/** Accessible custom listbox styled like the rest of the UI (native selects can't be themed). */
export default function Select({
  value,
  onChange,
  options,
  label,
  placeholder = "Any",
  className = "",
  align = "left",
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  label: string;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const id = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, options, value]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(i: number) {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      return setOpen(true);
    }
    if (!open) return;
    if (e.key === "Escape" || e.key === "Tab") return setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${current?.label ?? placeholder}`}
        className={`input flex w-full items-center gap-2 text-left text-sm ${open ? "!border-white/25" : ""}`}
      >
        {icon}
        <span className={`flex-1 truncate ${current ? "" : "text-muted"}`}>{current?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={id}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={`glass-strong thin-scroll absolute z-50 mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-xl p-1 ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"}`}
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <li
                  key={o.value}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${i === active ? "bg-white/[0.08] text-fg" : "text-fg/80"}`}
                >
                  <span className="flex-1">
                    {o.label}
                    {o.hint && <span className="ml-2 text-xs text-muted">{o.hint}</span>}
                  </span>
                  <Check className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-accent" : "opacity-0"}`} />
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
