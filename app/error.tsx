"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto mt-32 max-w-md px-4 text-center">
      <TriangleAlert className="mx-auto h-6 w-6 text-muted" />
      <h1 className="mt-3 text-lg font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-1.5 text-sm text-muted">The error was logged. Try again, or head back home.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/" className="btn btn-ghost">Home</Link>
      </div>
    </div>
  );
}
