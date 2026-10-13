"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const PROVIDERS = [{ id: "one", label: "One" }] as const;
const KEY = "ak_provider";

/** The provider you picked stays picked on this device (a cookie plus local storage). */
function remember(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  document.cookie = `${KEY}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
}
function recall() {
  try {
    const saved = localStorage.getItem(KEY) ?? document.cookie.match(/(?:^|; )ak_provider=([^;]*)/)?.[1];
    return PROVIDERS.find((p) => p.id === saved)?.id ?? PROVIDERS[0].id;
  } catch {
    return PROVIDERS[0].id;
  }
}

export default function ProviderDropdown({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const option = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [chosen, setChosen] = useState<string>(PROVIDERS[0].id);
  useEffect(() => setChosen(recall()), []);
  const label = PROVIDERS.find((p) => p.id === chosen)?.label ?? PROVIDERS[0].label;

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
          <span id={`${id}-value`}>{label}</span>
          <ChevronDown aria-hidden="true" className={`h-3 w-3 text-muted transition-transform duration-150 ${open && !disabled ? "rotate-180" : ""}`} />
        </button>
        {open && !disabled && (
          <div id={`${id}-menu`} role="menu" aria-labelledby={`${id}-label`} className="glass-strong absolute left-0 top-full z-30 mt-2 w-56 rounded-xl p-1 shadow-xl">
            {PROVIDERS.map((p, i) => {
              const on = p.id === chosen;
              return (
                <button
                  key={p.id}
                  ref={i === 0 ? option : undefined}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  tabIndex={-1}
                  onClick={() => {
                    setChosen(p.id);
                    remember(p.id);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                  onKeyDown={(event) => {
                    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) event.preventDefault();
                  }}
                  className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/40 ${on ? "bg-accent/10 text-accent hover:bg-accent/15 focus:bg-accent/15" : "text-fg hover:bg-white/[0.06]"}`}
                >
                  <span>{p.label}</span>
                  {on && (
                    <span className="ml-auto flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium">
                      <Check aria-hidden="true" className="h-3 w-3" /> Chosen
                    </span>
                  )}
                </button>
              );
            })}
            <p className="px-3 pb-2 pt-2 text-[11px] leading-snug text-muted">Your choice is remembered on this device.</p>
          </div>
        )}
      </div>
    </div>
  );
}
