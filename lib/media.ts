import { prisma } from "./db";
import { cached } from "./cache";
import { getMediaBatch, type LightMedia, type MediaDetail } from "./anilist";
import { pickTitle } from "./prefs-shared";

type SnapshotSource = Pick<LightMedia, "id" | "title" | "format" | "status" | "episodes" | "duration" | "genres" | "season" | "seasonYear" | "averageScore" | "bannerImage"> & {
  coverImage: { large: string };
  isAdult?: boolean;
  studios?: { nodes: { name: string }[] };
  tags?: { name: string; rank: number; isMediaSpoiler: boolean }[];
};

const STALE_MS = 7 * 24 * 3600_000;

function toRow(m: SnapshotSource) {
  return {
    title: pickTitle(m.title, "english"),
    titleRomaji: m.title.romaji,
    titleNative: m.title.native,
    coverImage: m.coverImage.large,
    bannerImage: m.bannerImage,
    format: m.format,
    status: m.status,
    episodes: m.episodes,
    duration: m.duration ?? null,
    genres: JSON.stringify(m.genres ?? []),
    studios: JSON.stringify(m.studios?.nodes.map((s) => s.name) ?? []),
    tags: JSON.stringify((m.tags ?? []).filter((t) => !t.isMediaSpoiler && t.rank >= 50).slice(0, 12).map((t) => t.name)),
    season: m.season,
    seasonYear: m.seasonYear,
    averageScore: m.averageScore,
    isAdult: m.isAdult ?? false,
  };
}

export async function saveSnapshot(m: SnapshotSource | MediaDetail) {
  const row = toRow(m as SnapshotSource);
  await prisma.mediaSnapshot.upsert({ where: { anilistId: m.id }, create: { anilistId: m.id, ...row }, update: row });
}

export type Snapshot = {
  anilistId: number;
  title: string;
  titleRomaji: string | null;
  titleNative: string | null;
  coverImage: string;
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  genres: string[];
  studios: string[];
  tags: string[];
  season: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  isAdult: boolean;
};

function parseRow(r: Awaited<ReturnType<typeof prisma.mediaSnapshot.findMany>>[number]): Snapshot {
  const arr = (s: string) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  return { ...r, genres: arr(r.genres), studios: arr(r.studios), tags: arr(r.tags) };
}

/** Snapshots for the given ids, fetching missing or week-old ones from AniList in batches. */
export async function getSnapshots(ids: number[]): Promise<Map<number, Snapshot>> {
  const unique = [...new Set(ids)].filter((n) => Number.isSafeInteger(n) && n > 0);
  if (!unique.length) return new Map();
  const rows = await prisma.mediaSnapshot.findMany({ where: { anilistId: { in: unique } } });
  const have = new Map(rows.map((r) => [r.anilistId, r]));
  const missing = unique.filter((id) => {
    const r = have.get(id);
    return !r || Date.now() - r.updatedAt.getTime() > STALE_MS;
  });
  if (missing.length) {
    try {
      const fresh = await getMediaBatch(missing.slice(0, 200));
      for (const m of fresh) {
        await saveSnapshot(m);
        const saved = await prisma.mediaSnapshot.findUnique({ where: { anilistId: m.id } });
        if (saved) have.set(m.id, saved);
      }
    } catch {
      // stale data is better than none if AniList is unavailable
    }
  }
  return new Map([...have.entries()].map(([id, r]) => [id, parseRow(r)]));
}

export type AiringInfo = { id: number; latestAired: number | null; nextEpisode: number | null; nextAiringAt: number | null; total: number | null; status: string | null };

/** Latest aired episode per show, cached 15 minutes per id. */
export async function getAiringInfo(ids: number[]): Promise<Map<number, AiringInfo>> {
  const unique = [...new Set(ids)];
  const out = new Map<number, AiringInfo>();
  const g = globalThis as unknown as { __awAiring?: Map<number, { at: number; info: AiringInfo }> };
  const store = (g.__awAiring ??= new Map());
  const need = unique.filter((id) => {
    const hit = store.get(id);
    if (hit && Date.now() - hit.at < 15 * 60_000) {
      out.set(id, hit.info);
      return false;
    }
    return true;
  });
  if (need.length) {
    const fresh = await cached(`airing:${need.sort((a, b) => a - b).join(",")}`, 60 * 15, () => getMediaBatch(need));
    for (const m of fresh) {
      const latest = m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : m.status === "FINISHED" ? m.episodes : m.status === "NOT_YET_RELEASED" ? 0 : null;
      const info: AiringInfo = {
        id: m.id,
        latestAired: latest,
        nextEpisode: m.nextAiringEpisode?.episode ?? null,
        nextAiringAt: m.nextAiringEpisode?.airingAt ?? null,
        total: m.episodes,
        status: m.status,
      };
      store.set(m.id, { at: Date.now(), info });
      out.set(m.id, info);
      saveSnapshot(m).catch(() => {});
    }
  }
  return out;
}
