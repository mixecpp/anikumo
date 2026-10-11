import { NextResponse, type NextRequest } from "next/server";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Blocks cross-site writes to the API (CSRF). Session cookies are SameSite=Lax already;
 * this also stops requests from other origins that browsers would otherwise send.
 */
export function middleware(req: NextRequest) {
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
