type Bucket = { hits: number[] };

const g = globalThis as unknown as { __awRate?: Map<string, Bucket> };
const buckets = g.__awRate ?? new Map<string, Bucket>();
g.__awRate = buckets;

/** Sliding-window limiter. Returns ok=false with seconds until the oldest hit expires. */
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= max) {
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - b.hits[0])) / 1000) };
  }
  b.hits.push(now);
  buckets.set(key, b);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.hits.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * The caller's IP for rate limiting. Set TRUSTED_IP_HEADER when behind a proxy that sets one
 * (e.g. "cf-connecting-ip" on Cloudflare). Otherwise the rightmost X-Forwarded-For entry is used:
 * it's the one the nearest proxy appended, while earlier entries are whatever the client sent.
 */
export function clientIp(headers: Headers) {
  const trusted = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) return headers.get(trusted)?.split(",")[0].trim() || "unknown";
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) || headers.get("x-real-ip") || "local";
}
