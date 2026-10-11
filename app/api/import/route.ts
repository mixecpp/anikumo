import { NextResponse } from "next/server";
import { fail, requireUserId } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { importFromAniList, importFromMal } from "@/lib/importer";

export const maxDuration = 120;

/**
 * multipart/form-data:
 *   source=anilist&username=<name>        — public AniList list
 *   source=mal&file=<animelist.xml>       — MyAnimeList XML export
 *   overwrite=1                            — replace statuses/scores on existing entries
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to import", 401);
  if (!rateLimit(`import:${userId}`, 5, 60 * 60_000).ok) return fail("You've imported a few times already. Try again in an hour.", 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Expected form data");
  }
  const overwrite = form.get("overwrite") === "1";
  const source = form.get("source");

  try {
    if (source === "anilist") {
      const username = String(form.get("username") ?? "").trim();
      if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) return fail("Enter a valid AniList username");
      const result = await importFromAniList(userId, username, overwrite);
      if (!result) return fail("Couldn't find a public AniList anime list for that user", 404);
      return NextResponse.json(result);
    }
    if (source === "mal") {
      const file = form.get("file");
      if (!(file instanceof File)) return fail("Choose your MyAnimeList export file");
      if (file.size > 15 * 1024 * 1024) return fail("That file is too large (15 MB max)");
      let text = await file.text();
      if (file.name.endsWith(".gz") || text.charCodeAt(0) === 0x1f) {
        const { gunzipSync } = await import("node:zlib");
        text = gunzipSync(Buffer.from(await file.arrayBuffer())).toString("utf8");
      }
      if (!text.includes("<myanimelist>")) return fail("That doesn't look like a MyAnimeList export");
      return NextResponse.json(await importFromMal(userId, text, overwrite));
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Import failed", 502);
  }
  return fail("Unknown source");
}
