import Link from "next/link";
import { CloudOff } from "lucide-react";

export default function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-32 max-w-md px-4 text-center">
      <CloudOff className="mx-auto h-6 w-6 text-muted" />
      <h1 className="mt-3 text-lg font-semibold tracking-tight">Couldn&apos;t load anime data</h1>
      <p className="mt-1.5 text-sm text-muted">{message}</p>
      <p className="mt-1 text-xs text-muted">AniList may be rate-limiting requests. Wait a moment and try again.</p>
      <div className="mt-6 flex justify-center gap-2">
        <a href="" className="btn btn-ghost">
          Retry
        </a>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
