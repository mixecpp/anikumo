import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-28 max-w-md px-4 text-center">
      <div className="font-[family-name:var(--font-display)] text-7xl font-extrabold text-accent">404</div>
      <p className="mt-3 text-muted">This page wandered off into another isekai.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Back home
      </Link>
    </div>
  );
}
