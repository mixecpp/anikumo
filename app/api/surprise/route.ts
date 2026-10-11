import { NextResponse } from "next/server";
import { randomPick } from "@/lib/anilist";
import { parseBrowseParams } from "@/lib/browse-params";
import { getPrefs } from "@/lib/prefs";

/** GET ?<browse filters> → { id } of a random matching show. */
export async function GET(req: Request) {
  const params = parseBrowseParams(Object.fromEntries(new URL(req.url).searchParams));
  const prefs = await getPrefs();
  if (prefs.hideEcchi) params.excludeGenres = [...new Set([...(params.excludeGenres ?? []), "Ecchi"])];
  try {
    const pick = await randomPick({ ...params, page: undefined });
    if (!pick) return NextResponse.json({ error: "Nothing matches those filters" }, { status: 404 });
    return NextResponse.json({ id: pick.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't pick" }, { status: 502 });
  }
}
