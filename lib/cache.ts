type Entry = { value: unknown; expires: number };

const globalForCache = globalThis as unknown as { __awCache?: Map<string, Entry> };
const store = globalForCache.__awCache ?? new Map<string, Entry>();
globalForCache.__awCache = store;

const MAX_ENTRIES = 2000;
const inFlight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = fn();
  inFlight.set(key, request);
  let value: T;
  try { value = await request; } finally { inFlight.delete(key); }
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  return value;
}
