import { cached } from "../cache";
import { prisma } from "../db";
import { normalizeSettings } from "./settings";
import { parseAniweebPlayer, type PlaybackSource } from "./source";

export async function getPlaybackSettings(userId: string | null) {
  return normalizeSettings(userId ? await prisma.playbackSettings.findUnique({ where: { userId } }) : null);
}

export async function resolvePlaybackSource(anilistId: number, episode: number): Promise<PlaybackSource> {
  const fallbackUrl = `https://api.aniweeb.net/embed/ani/${anilistId}/${episode}?track=sub`;
  try {
    return await cached(`aniweeb-player:${anilistId}:${episode}`, 600, async () => {
      const res = await fetch(fallbackUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Aniweeb ${res.status}`);
      return parseAniweebPlayer(await res.text(), fallbackUrl);
    });
  } catch {
    return { url: fallbackUrl, fallbackUrl, protocol: "aniweeb", controls: false };
  }
}

export type RemoteEpisode = { number: number; title: string | null; thumbnail: string | null; sub: boolean; dub: boolean };
export async function getAniweebEpisodes(anilistId: number): Promise<RemoteEpisode[]> {
  try {
    return await cached(`aniweeb-episodes:${anilistId}`, 1800, async () => {
      const res = await fetch(`https://api.aniweeb.net/episodes/${anilistId}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Aniweeb ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.episodes)) throw new Error("Invalid episode list");
      const result = new Map<number, RemoteEpisode>();
      for (const e of json.episodes.slice(0, 5000)) {
        if (!Number.isSafeInteger(e.number) || e.number < 1 || e.number > 5000) continue;
        // Explicit availability comes from Aniweeb; do not invent unpublished episodes.
        if (e.sub !== true && e.dub !== true) continue;
        result.set(e.number, { number: e.number, title: typeof e.title === "string" ? e.title : null, thumbnail: typeof e.image === "string" && e.image.startsWith("https://") ? e.image : null, sub: e.sub === true, dub: e.dub === true });
      }
      return [...result.values()].sort((a, b) => a.number - b.number);
    });
  } catch { return []; }
}
