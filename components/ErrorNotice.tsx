export default function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-24 max-w-lg rounded-2xl border border-line bg-surface p-8 text-center">
      <div className="text-4xl">⚠</div>
      <h1 className="mt-3 text-lg font-semibold">Couldn&apos;t load anime data</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <p className="mt-4 text-xs text-muted">AniList may be rate-limiting. Wait a minute and refresh.</p>
    </div>
  );
}
