"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

/** Two-step destructive button: first click arms it, second click confirms. Disarms after 4s. */
export default function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  className = "",
}: {
  onConfirm: () => unknown;
  label: string;
  confirmLabel: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        await onConfirm();
        setBusy(false);
        setArmed(false);
      }}
      className={`btn !py-1.5 ${armed ? "bg-red-500/90 text-white hover:bg-red-500" : "btn-ghost text-muted hover:text-fg"} ${className}`}
    >
      {busy && <LoaderCircle className="spin h-3.5 w-3.5" />}
      {armed ? confirmLabel : label}
    </button>
  );
}
