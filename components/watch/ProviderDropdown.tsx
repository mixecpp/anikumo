"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function ProviderDropdown({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const option = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (disabled) { setOpen(false); return; }
    if (!open) return;
    option.current?.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, disabled]);

  return (
    <div ref={root} className="flex min-w-0 items-center gap-2 pl-1.5 sm:pl-2" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <span id={`${id}-label`} className="font-mono text-[11px] text-muted">Providers</span>
      <div className="relative">
        <button
          ref={trigger}
          type="button"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-haspopup="menu"
          aria-expanded={open && !disabled}
          aria-controls={open && !disabled ? `${id}-menu` : undefined}
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={`press flex h-8 items-center gap-2.5 rounded-lg border py-1 pl-2.5 pr-2 text-xs text-fg transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-35 ${open && !disabled ? "border-accent/30 bg-white/[0.07]" : "border-line bg-white/[0.04]"}`}
        >
          <span id={`${id}-value`}>One</span>
          <ChevronDown aria-hidden="true" className={`h-3 w-3 text-muted transition-transform duration-150 ${open && !disabled ? "rotate-180" : ""}`} />
        </button>
        {open && !disabled && (
          <div id={`${id}-menu`} role="menu" aria-labelledby={`${id}-label`} className="glass-strong absolute left-0 top-full z-30 mt-2 w-36 rounded-xl p-1 shadow-xl">
            <button
              ref={option}
              type="button"
              role="menuitemradio"
              aria-checked="true"
              tabIndex={-1}
              onClick={() => { setOpen(false); trigger.current?.focus(); }}
              onKeyDown={(event) => {
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) event.preventDefault();
              }}
              className="flex w-full items-center justify-between gap-4 rounded-lg bg-accent/10 px-3 py-2.5 text-xs text-accent transition-colors hover:bg-accent/15 focus:bg-accent/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/40"
            >
              <span>One</span>
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
