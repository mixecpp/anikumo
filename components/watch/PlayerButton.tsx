import type { ComponentProps, ReactNode } from "react";

export const playerButtonClass = "press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.07] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted sm:h-9 sm:w-9";

export default function PlayerButton({ label, children, className = "", ...props }: ComponentProps<"button"> & { label: string; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} className={`${playerButtonClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
