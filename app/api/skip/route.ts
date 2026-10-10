import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { toInt } from "@/lib/http";

type Skip = { type: "op" | "ed"; start: number; end: number };

// Community intro/outro timestamps from AniSkip (keyed by MyAnimeList ID).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const malId = toInt(sp.get("malId"));
  const ep = toInt(sp.get("ep"));
  if (!malId || !ep) return NextResponse.json({ skips: [] });

  const skips = await cached(`skip:${malId}:${ep}`, 60 * 60 * 24, async () => {
    try {
      const res = await fetch(
        `https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types=op&types=ed&episodeLength=0`,
        { cache: "no-store" },
      );
      if (!res.ok) return [] as Skip[];
      const json = await res.json();
      if (!json.found) return [] as Skip[];
      return (json.results as { skipType: string; interval: { startTime: number; endTime: number } }[]).map(
        (r) => ({ type: r.skipType as "op" | "ed", start: r.interval.startTime, end: r.interval.endTime }),
      );
    } catch {
      return [] as Skip[];
    }
  });
  return NextResponse.json({ skips });
}
