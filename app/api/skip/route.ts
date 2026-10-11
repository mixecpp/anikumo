import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { positiveId } from "@/lib/playback/progress";

type Skip = { type: "op" | "ed"; start: number; end: number };

// Community intro/outro timestamps from AniSkip (keyed by MyAnimeList ID).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const malId = positiveId(sp.get("malId"));
  const ep = positiveId(sp.get("ep"));
  if (!malId || !ep) return NextResponse.json({ skips: [] });

  const skips = await cached(`skip:${malId}:${ep}`, 60 * 60 * 24, async () => {
    try {
      const res = await fetch(
        `https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types=op&types=ed&episodeLength=0`,
        { cache: "no-store", signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) return [] as Skip[];
      const json = await res.json();
      if (!json.found) return [] as Skip[];
      return (json.results as { skipType: string; interval: { startTime: number; endTime: number } }[]).filter((r) =>
        (r.skipType === "op" || r.skipType === "ed") && Number.isFinite(r.interval?.startTime) && Number.isFinite(r.interval?.endTime) && r.interval.startTime >= 0 && r.interval.endTime > r.interval.startTime,
      ).map(
        (r) => ({ type: r.skipType as "op" | "ed", start: r.interval.startTime, end: r.interval.endTime }),
      );
    } catch {
      return [] as Skip[];
    }
  });
  return NextResponse.json({ skips });
}
