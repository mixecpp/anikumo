import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalisePath, recordView } from "@/lib/traffic";

/** POST { path } — one page view (see lib/traffic.ts). Always answers 204 so it never shows up as an error. */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const ua = req.headers.get("user-agent") ?? "";
  const body = await readJson<{ path: string }>(req);
  const path = normalisePath(body.path);
  // Bots and scripts mostly don't run our JS; the ones that do are capped per IP.
  if (path && ua && !/bot|crawl|spider|headless|lighthouse/i.test(ua) && rateLimit(`hit:${ip}`, 60, 60_000).ok) {
    await recordView({ path, ip, userAgent: ua, guest: !(await getUserId()) }).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
