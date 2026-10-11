"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0e0e0f", color: "#ececee", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>AniKumo hit an unexpected error</h1>
          <p style={{ color: "#85858d", fontSize: 14 }}>It was logged for the admin.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 10, border: 0, background: "#fafafa", color: "#0a0a0b", cursor: "pointer" }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
