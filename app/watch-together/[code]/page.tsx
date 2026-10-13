import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, DoorClosed } from "lucide-react";
import { getMedia } from "@/lib/anilist";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildEpisodes, getLibraryEpisodes } from "@/lib/episodes";
import { getUi } from "@/lib/server-i18n";
import { sourceSetup } from "@/lib/providers";
import { getAniweebEpisodes, getPlaybackSettings, resolvePlaybackSource } from "@/lib/playback/server";
import { normaliseCode, openRoom } from "@/lib/rooms";
import RoomClient from "@/components/rooms/RoomClient";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = await openRoom(normaliseCode((await params).code));
  return { title: room ? `${room.name} · Watch together` : "Watch together", robots: { index: false, follow: false } };
}

export default async function RoomPage({ params }: Props) {
  const code = normaliseCode((await params).code);
  const room = await openRoom(code);
  if (!room) return <Ended />;

  const { anilistId: id, episode: ep } = room;
  const [m, userId] = await Promise.all([getMedia(id), getUserId()]);
  if (!m) return <Ended />;
  const [libraryEps, source, settings, remoteEpisodes, row, ui] = await Promise.all([
    getLibraryEpisodes(id),
    resolvePlaybackSource(id, ep),
    getPlaybackSettings(userId),
    getAniweebEpisodes(id),
    userId ? prisma.watchProgress.findUnique({ where: { userId_anilistId_episode: { userId, anilistId: id, episode: ep } } }) : null,
    getUi(),
  ]);
  const episodes = remoteEpisodes.length ? remoteEpisodes : buildEpisodes(m, libraryEps);
  const title = ui.title(m.title);

  return (
    <RoomClient
      key={`${id}:${ep}`}
      code={room.code}
      episodes={episodes.map((e) => e.number)}
      player={{
        href: `/watch-together/${room.code}`,
        image: m.coverImage.large,
        anilistId: id,
        episode: ep,
        idMal: m.idMal,
        title,
        coverImage: m.coverImage.large,
        // Start where the host is right now.
        resumeAt: Math.floor(room.playing ? room.position + (Date.now() - room.positionAt.getTime()) / 1000 : room.position),
        completed: row?.completed ?? false,
        hasNext: false,
        nextEpisode: null,
        hasPrev: false,
        userId,
        embedsEnabled: sourceSetup().embeds,
        source,
        // In a room the start time comes from the host, so "resume" is always on.
        initialSettings: { ...settings, resume: true, autoplay: true },
      }}
    />
  );
}

function Ended() {
  return (
    <div className="mx-auto max-w-md px-4 pt-24 text-center">
      <DoorClosed className="mx-auto h-8 w-8 text-muted" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">This room has ended</h1>
      <p className="mt-2 text-sm text-muted">The host closed it, or it was empty for a while. Check the code, or find another room.</p>
      <Link href="/watch-together" className="btn btn-primary mt-6">
        <ArrowLeft className="h-4 w-4" /> Watch together
      </Link>
    </div>
  );
}
