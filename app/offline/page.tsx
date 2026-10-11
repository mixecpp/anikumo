import Link from "next/link";
import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto mt-32 max-w-md px-4 text-center">
      <WifiOff className="mx-auto h-6 w-6 text-muted" />
      <h1 className="mt-3 text-xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-1.5 text-sm text-muted">Pages you visited recently still open. Everything else will be back when you reconnect.</p>
      <Link href="/" className="btn btn-ghost mt-6">Try again</Link>
    </div>
  );
}
