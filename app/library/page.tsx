import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { libraryRoot } from "@/lib/library";
import ScanButton from "@/components/ScanButton";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const userId = await getUserId();
  const root = libraryRoot();
  const series = await prisma.librarySeries.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { episodes: true } } },
  });

  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">My Library</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Anime files on your PC, matched to AniList and streamed in the player with resume, skip-intro and subtitles.
          </p>
        </div>
        {userId ? (
          <ScanButton />
        ) : (
          <Link href="/login?next=/library" className="btn btn-primary">
            Log in to scan
          </Link>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm">
        <div className="font-semibold">How it works</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>
            Set <code className="rounded bg-surface-2 px-1.5 py-0.5 text-fg">LIBRARY_DIR</code> in <code className="rounded bg-surface-2 px-1.5 py-0.5 text-fg">.env</code>{" "}
            — currently: <code className="rounded bg-surface-2 px-1.5 py-0.5 text-fg">{root ?? "not set"}</code>
          </li>
          <li>
            One folder per series, e.g. <code className="text-fg">Frieren\Frieren - 01.mkv</code>. Add the AniList ID to force a match:{" "}
            <code className="text-fg">Frieren [154587]</code>
          </li>
          <li>
            Optional subtitles next to the video with the same name: <code className="text-fg">Frieren - 01.srt</code> or <code className="text-fg">.vtt</code>
          </li>
          <li>Click Scan. Episodes then show up with a green dot and play in the watch page.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">Browsers play H.264/AAC MP4 and MKV, and WebM. HEVC/x265 files usually won&apos;t play.</p>
      </div>

      {series.length === 0 ? (
        <p className="mt-16 text-center text-muted">Your library is empty.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {series.map((s) => {
            const inner = (
              <>
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-2">
                  {s.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.coverImage} alt="" className="h-full w-full object-cover transition group-hover:brightness-75" />
                  ) : (
                    <div className="grid h-full place-items-center p-3 text-center text-xs text-muted">Unmatched</div>
                  )}
                  <span className="absolute bottom-2 left-2 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[11px] font-semibold text-black">
                    {s._count.episodes} files
                  </span>
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-accent-2">{s.title}</div>
                <div className="truncate text-xs text-muted" title={s.folderName}>
                  {s.folderName}
                </div>
              </>
            );
            return s.anilistId ? (
              <Link key={s.id} href={`/anime/${s.anilistId}`} className="group">
                {inner}
              </Link>
            ) : (
              <div key={s.id} className="group opacity-70">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
