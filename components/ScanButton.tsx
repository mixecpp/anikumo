"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function scan() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/library/scan", { method: "POST" });
    const j = await res.json();
    if (j.error) setResult(j.error);
    else
      setResult(
        `Found ${j.series} series, ${j.episodes} episodes.` +
          (j.unmatched.length ? ` Couldn't match: ${j.unmatched.join(", ")}` : ""),
      );
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <button onClick={scan} disabled={busy} className="btn btn-primary">
        {busy ? "Scanning…" : "Scan library"}
      </button>
      {result && <p className="mt-3 text-sm text-muted">{result}</p>}
    </div>
  );
}
