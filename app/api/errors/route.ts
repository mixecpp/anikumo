import { NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { getUserId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Receives client-side errors from error boundaries. */
export async function POST(req: Request) {
  if (!rateLimit(`clienterr:${clientIp(req.headers)}`, 20, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  const b = await readJson<{ message: string; stack: string; digest: string; path: string }>(req);
  if (!b.message) return NextResponse.json({ ok: false }, { status: 400 });
  await logError({ source: "client", message: String(b.message), stack: String(b.stack ?? ""), digest: String(b.digest ?? ""), path: String(b.path ?? ""), userId: await getUserId() });
  return NextResponse.json({ ok: true });
}
