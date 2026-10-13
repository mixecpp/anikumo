import { NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";
import { getUserId } from "./auth";

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUserId() {
  const id = await getUserId();
  return id;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Per-account limit for write routes: returns a 429 response when someone is going too fast,
 * otherwise null. Usage: `const slow = tooFast(\`likes:${userId}\`, 120); if (slow) return slow;`
 */
export function tooFast(key: string, max: number, windowMs = 60_000) {
  return rateLimit(key, max, windowMs).ok ? null : fail("You're doing that too fast — try again in a moment", 429);
}
