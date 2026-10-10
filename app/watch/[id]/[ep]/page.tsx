import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMedia, prettyEnum, titleOf } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildEpisodes, getEpisodeProgress, getLibraryEpisodes } from "@/lib/episodes";
import WatchClient from "@/components/WatchClient";
import EpisodeGrid from "@/components/EpisodeGrid";
import Comments from "@/components/Comments";

type Props = { params: Promise<{ id: string; ep: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, ep } = await params;
  const m = await getMedia(Number(id)).catch(() => null);
  return { title: m ? `${titleOf(m)} · Episode ${ep}` : "Watch" };
}

export default async function WatchPage({ params }: Props) {
  const { id: idStr, ep: epStr } = await params;
  const id = Number(idStr);
  const ep = Number(epStr);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(ep) || ep < 1) notFound();

  const [m, userId] = await Promise.all([getMedia(id), getUserId()]);
  if (!m) notFound();

  const [progress, libraryEps, row] = await Promise.all([
    getEpisodeProgress(userId, id),
    getLibraryEpisodes(id),
    userId
      ? prisma.watchProgress.findUnique({ where: { userId_anilistId_episode: { userId, anilistId: id, episode: ep } } })
      : null,
  ]);

  const episodes = buildEpisodes(m, libraryEps);
  const title = titleOf(m);
  const epInfo = episodes.find((e) => e.number === ep);
  const total = episodes.length;

  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-6 md:px-8">
      <nav className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-fg">
          Home
        </Link>
        <span>/</span>
        <Link href={`/anime/${id}`} className="truncate hover:text-fg">
          {title}
        </Link>
        <span>/</span>
        <span className="text-fg">Episode {ep}</span>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <WatchClient
            anilistId={id}
            episode={ep}
            idMal={m.idMal}
            title={title}
            coverImage={m.coverImage.large}
            resumeAt={row?.progressSeconds ?? 0}
            completed={row?.completed ?? false}
            hasNext={ep < total}
            hasPrev={ep > 1}
            loggedIn={!!userId}
          />

          <div className="mt-6 flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.coverImage.large} alt="" className="hidden h-28 w-20 rounded-lg object-cover sm:block" />
            <div>
              <Link href={`/anime/${id}`} className="font-[family-name:var(--font-display)] text-2xl font-bold hover:text-accent-2">
                {title}
              </Link>
              <div className="mt-1 text-sm text-muted">
                Episode {ep}
                {epInfo?.title ? ` · ${epInfo.title}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[prettyEnum(m.format), m.seasonYear, m.averageScore ? `★ ${(m.averageScore / 10).toFixed(1)}` : null, ...m.genres.slice(0, 3)]
                  .filter(Boolean)
                  .map((x) => (
                    <span key={String(x)} className="chip">
                      {x}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div className="mt-10">
            <Comments anilistId={id} episode={ep} loggedIn={!!userId} />
          </div>
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Episodes</h2>
              <span className="text-xs text-muted">{total} total</span>
            </div>
            <div className="thin-scroll max-h-[70vh] overflow-y-auto pr-1">
              <EpisodeGrid anilistId={id} episodes={episodes} progress={progress} libraryEpisodes={libraryEps} current={ep} compact />
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
            <div className="mb-1 font-semibold text-fg">Shortcuts</div>
            Space/K play · J/L ±10s · ←/→ ±5s · ↑/↓ volume · F fullscreen · M mute · C captions · S skip intro · N next · 0–9 jump
          </div>
        </aside>
      </div>
    </div>
  );
}
