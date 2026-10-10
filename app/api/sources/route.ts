import { NextResponse } from "next/server";
import { getMedia, titleOf } from "@/lib/anilist";
import { resolveSources } from "@/lib/providers";
import { fail, toInt } from "@/lib/http";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = toInt(sp.get("id"));
  const ep = toInt(sp.get("ep"));
  if (!id || !ep || ep < 1) return fail("id and ep required");

  const media = await getMedia(id);
  if (!media) return fail("Anime not found", 404);

  const titles = [titleOf(media), media.title.romaji, media.title.english, ...media.synonyms].filter(
    (t, i, arr): t is string => !!t && arr.indexOf(t) === i,
  );

  const results = await resolveSources({
    anilistId: id,
    episode: ep,
    titles,
    totalEpisodes: media.episodes,
    streamingEpisodes: media.streamingEpisodes,
    externalLinks: media.externalLinks,
  });
  return NextResponse.json({ providers: results });
}
