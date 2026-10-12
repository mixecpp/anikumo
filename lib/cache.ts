/**
 * Server-side cache with stale-while-revalidate.
 *
 *  - Fresh entry: returned straight away.
 *  - Expired entry: the old value is returned straight away and refreshed in the background,
 *    so nobody waits on AniList (and if AniList is slow, rate-limited or down, people still get
 *    the last good copy).
 *  - AniList data (see PERSIST) is also saved to the database by lib/cache-store.ts, so a restart
 *    or deploy doesn't start cold. lib/warm.ts refreshes the busiest entries every 10 minutes.
 *
 * This file must stay free of server-only imports: lib/anilist.ts (which uses it) is also
 * bundled into a few client components for its helpers.
 */
type Entry = { value: unknown; expires: number };
export type CachePersistence = {
  read: (key: string) => Promise<Entry | null>;
  write: (key: string, value: unknown, expires: number) => Promise<void>;
};

const g = globalThis as unknown as { __awCache?: Map<string, Entry>; __awInFlight?: Map<string, Promise<unknown>>; __akCachePersist?: CachePersistence; __akForceNext?: boolean };
const store = (g.__awCache ??= new Map<string, Entry>());
const inFlight = (g.__awInFlight ??= new Map<string, Promise<unknown>>());

const MAX_ENTRIES = 3000;
/** Expired data is still served (while it refreshes) for up to a week. */
export const STALE_FOR = 7 * 24 * 3600_000;
const PERSIST = ["home:", "browse:", "rand-head:", "media:", "sched:", "sched-for:", "season:", "chart:", "similar:", "char:", "staff:", "studio:", "rel:", "tags", "banners:", "qs:"];
const persists = (key: string) => PERSIST.some((p) => key.startsWith(p));

/** Registered on the server at startup (lib/cache-store.ts). */
export function setCachePersistence(p: CachePersistence) {
  g.__akCachePersist = p;
}

/**
 * Runs `fn` and makes its cached() lookup refetch (and wait) instead of serving what it has.
 * The AniList helpers call cached() synchronously, so the flag only ever applies to that call.
 */
export async function warm<T>(fn: () => Promise<T>): Promise<T> {
  g.__akForceNext = true;
  let promise: Promise<T>;
  try {
    promise = fn();
  } finally {
    g.__akForceNext = false;
  }
  return promise;
}

function remember(key: string, value: unknown, expires: number) {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires });
}

function load<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const request = (async () => {
    try {
      const value = await fn();
      const expires = Date.now() + ttlSeconds * 1000;
      remember(key, value, expires);
      if (persists(key)) await g.__akCachePersist?.write(key, value, expires).catch(() => {});
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, request);
  return request;
}

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  if (g.__akForceNext) {
    g.__akForceNext = false;
    return load(key, ttlSeconds, fn);
  }

  let hit = store.get(key);
  if (!hit && persists(key) && g.__akCachePersist) {
    const row = await g.__akCachePersist.read(key).catch(() => null);
    if (row && row.expires + STALE_FOR > Date.now()) {
      hit = row;
      remember(key, row.value, row.expires);
    }
  }
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (hit && Date.now() - hit.expires < STALE_FOR) {
    // Serve what we have now; refresh quietly for the next person.
    load(key, ttlSeconds, fn).catch(() => {});
    return hit.value as T;
  }
  return load(key, ttlSeconds, fn);
}
