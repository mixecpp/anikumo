"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { toast } from "@/lib/toast";

/** Shows a freshly issued recovery key once, with copy/download and an "I saved it" gate. */
export default function RecoveryKey({ value, username, onDone, doneLabel = "Continue" }: { value: string; username: string; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);

  function download() {
    const text = `AniKumo recovery key\n\nUsername: ${username}\nRecovery key: ${value}\n\nUse this at /forgot-password if you forget your password.\nKeep it somewhere safe. Anyone with it can reset your password.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `anikumo-recovery-${username}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/[0.04] p-4 text-center">
        <code className="block select-all break-all font-mono text-base tracking-wider" aria-label="Recovery key">
          {value}
        </code>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => toast("Copied"))} className="btn btn-ghost flex-1 !py-2">
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        <button type="button" onClick={download} className="btn btn-ghost flex-1 !py-2">
          <Download className="h-3.5 w-3.5" /> Download
        </button>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
        I&apos;ve saved my recovery key somewhere safe.
      </label>
      <button type="button" onClick={onDone} disabled={!saved} className="btn btn-primary w-full !py-2.5">
        <Check className="h-4 w-4" /> {doneLabel}
      </button>
    </div>
  );
}
