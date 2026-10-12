import { NextResponse } from "next/server";
import { gql, titleOf, type Title } from "@/lib/anilist";
import { cached } from "@/lib/cache";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type Row = { id: number; title: Title; bannerImage: string | null };

/** GET ?q= → anime banners for the profile banner picker (trending ones when q is empty). */
export async function GET(req: Request) {
  if (!rateLimit(`banners:${clientIp(req.headers)}`, 60, 60_000).ok) return NextResponse.json({ banners: [] }, { status: 429 });
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const banners = await cached(`banners:${q.toLowerCase()}`, 60 * 30, async () => {
    const data = await gql<{ Page: { media: Row[] } }>(
      `query ($q: String, $sort: [MediaSort]) { Page(perPage: 24) { media(type: ANIME, search: $q, isAdult: false, sort: $sort) { id title { romaji english native userPreferred } bannerImage } } }`,
      { q: q || null, sort: q ? ["SEARCH_MATCH"] : ["TRENDING_DESC"] },
    );
    return data.Page.media.filter((m) => m.bannerImage).map((m) => ({ id: m.id, title: titleOf(m), image: m.bannerImage! }));
  }).catch(() => []);
  return NextResponse.json({ banners });
}
