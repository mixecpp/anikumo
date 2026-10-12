import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "./lib/rate-limit";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * A safety net in front of every API route: each network gets a generous budget per minute
 * (routes add their own tighter per-account limits on top). Stops scripts hammering the site.
 */
function overBudget(req: NextRequest) {
  const write = !SAFE.has(req.method);
  const r = rateLimit(`api-${write ? "w" : "r"}:${clientIp(req.headers)}`, write ? 150 : 900, 60_000);
  return r.ok ? null : NextResponse.json({ error: "Too many requests — slow down a little." }, { status: 429, headers: { "Retry-After": String(r.retryAfter) } });
}

/**
 * Blocks cross-site writes to the API (CSRF). Session cookies are SameSite=Lax already;
 * this also stops requests from other origins that browsers would otherwise send.
 */
export function middleware(req: NextRequest) {
  const limited = overBudget(req);
  if (limited) return limited;
  if (SAFE.has(req.method)) return NextResponse.next();

  const origin = req.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {}
    const allowed = new Set([req.headers.get("x-forwarded-host"), req.headers.get("host"), hostOf(process.env.APP_URL)].filter(Boolean));
    if (!allowed.has(originHost)) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  } else if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  }
  return NextResponse.next();
}

function hostOf(url?: string) {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
}

export const config = { matcher: "/api/:path*" };
