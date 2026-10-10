import { NextResponse } from "next/server";
import { quickSearch, titleOf } from "@/lib/anilist";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const media = await quickSearch(q.slice(0, 100));
    return NextResponse.json({
      results: media.map((m) => ({
        id: m.id,
        title: titleOf(m),
        cover: m.coverImage.large,
        year: m.seasonYear,
        format: m.format,
        episodes: m.episodes,
      })),
    });
  } catch (e) {
    return NextResponse.json({ results: [], error: e instanceof Error ? e.message : "Search failed" });
  }
}
