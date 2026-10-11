import { NextResponse } from "next/server";
import { browse } from "@/lib/anilist";
import { parseBrowseParams } from "@/lib/browse-params";
import { getPrefs } from "@/lib/prefs";

export async function GET(req: Request) {
  const params = parseBrowseParams(Object.fromEntries(new URL(req.url).searchParams));
  const prefs = await getPrefs();
  if (prefs.hideEcchi && !params.genres?.includes("Ecchi")) params.excludeGenres = [...new Set([...(params.excludeGenres ?? []), "Ecchi"])];
  try {
    return NextResponse.json(await browse(params));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Browse failed" }, { status: 502 });
  }
}
