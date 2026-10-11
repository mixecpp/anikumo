import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-32 max-w-md px-4 text-center">
      <div className="font-mono text-sm text-muted">404</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-sm text-muted">It may have moved, or the link is wrong.</p>
      <div className="mt-8 flex justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          Go home
        </Link>
        <Link href="/browse" className="btn btn-ghost">
          Browse anime
        </Link>
      </div>
    </div>
  );
}
