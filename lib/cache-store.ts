import { prisma } from "./db";
import { STALE_FOR, setCachePersistence } from "./cache";

/** Saves cached AniList data in the database so restarts and deploys start warm (server only). */
export function installCacheStore() {
  setCachePersistence({
    async read(key) {
      const row = await prisma.cacheEntry.findUnique({ where: { key } });
      if (!row) return null;
      try {
        return { value: JSON.parse(row.value), expires: row.expires.getTime() };
      } catch {
        return null;
      }
    },
    async write(key, value, expires) {
      const json = JSON.stringify(value);
      await prisma.cacheEntry.upsert({ where: { key }, create: { key, value: json, expires: new Date(expires) }, update: { value: json, expires: new Date(expires) } });
    },
  });
}

/** Drops database cache rows that are past their stale window. */
export async function pruneCache() {
  await prisma.cacheEntry.deleteMany({ where: { expires: { lt: new Date(Date.now() - STALE_FOR) } } }).catch(() => {});
}
