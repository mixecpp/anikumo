import { NextResponse } from "next/server";
import { getMedia, titleOf } from "@/lib/anilist";
import { resolveSources, sourceSetup } from "@/lib/providers";
import { fail } from "@/lib/http";
import { resolvePlaybackSource } from "@/lib/playback/server";
import { playbackUrl } from "@/lib/playback/source";
import { defaultPlaybackSettings } from "@/lib/playback/settings";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = Number(sp.get("id"));
  const ep = Number(sp.get("ep"));
  const track = sp.get("track") ?? "sub";
  if (track !== "sub" && track !== "dub") return fail("track must be sub or dub");
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(ep) || ep < 1) {
    return fail("id and ep must be positive integers");
  }

  let media;
  try {
    media = await getMedia(id);
  } catch {
    return fail("Could not load anime metadata. Please try again.", 502);
  }
  if (!media) return fail("Anime not found", 404);

  const titles = [titleOf(media), media.title.romaji, media.title.english, ...media.synonyms].filter(
    (t, i, arr): t is string => !!t && arr.indexOf(t) === i,
  );

  const results = await resolveSources({
    anilistId: id,
    episode: ep,
    audioTrack: track,
    titles,
    totalEpisodes: media.episodes,
    startYear: media.startDate.year,
    streamingEpisodes: media.streamingEpisodes,
    externalLinks: media.externalLinks,
  });
  const aniweeb = results.find((provider) => provider.id === "aniweeb" && provider.sources.length);
  if (aniweeb) {
    const source = await resolvePlaybackSource(id, ep);
    aniweeb.sources[0] = { ...aniweeb.sources[0], url: playbackUrl(source, { ...defaultPlaybackSettings, audioTrack: track }, 0), fallbackUrl: source.fallbackUrl, controls: source.controls };
  }
  return NextResponse.json({ providers: results, setup: sourceSetup() });
}
