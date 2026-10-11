import { prisma } from "./db";
import { fuzzyDate, getAniListUserList, getMediaByMalIds, type LightMedia } from "./anilist";
import { saveSnapshot } from "./media";
import { pickTitle } from "./prefs-shared";
import type { ListStatus } from "./list-shared";

export type ImportResult = { imported: number; updated: number; skipped: number; unmatched: number };

type Incoming = {
  anilistId: number;
  status: ListStatus;
  score: number | null;
  progress: number;
  rewatching: boolean;
  rewatchCount: number;
  notes: string;
  startedAt: Date | null;
  completedAt: Date | null;
  title: string;
  coverImage: string;
};

/** Writes entries. Existing entries keep the higher progress and are only overwritten when `overwrite` is set. */
async function writeEntries(userId: string, items: Incoming[], overwrite: boolean): Promise<Omit<ImportResult, "unmatched">> {
  const existing = new Map((await prisma.listEntry.findMany({ where: { userId } })).map((e) => [e.anilistId, e]));
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  for (const it of items) {
    const cur = existing.get(it.anilistId);
    if (!cur) {
      await prisma.listEntry.create({ data: { userId, ...it } });
      imported++;
    } else if (overwrite) {
      await prisma.listEntry.update({
        where: { id: cur.id },
        data: { ...it, progress: Math.max(cur.progress, it.progress), notes: it.notes || cur.notes, score: it.score ?? cur.score },
      });
      updated++;
    } else {
      const data: Record<string, unknown> = {};
      if (it.progress > cur.progress) data.progress = it.progress;
      if (cur.score === null && it.score !== null) data.score = it.score;
      if (!cur.notes && it.notes) data.notes = it.notes;
      if (Object.keys(data).length) {
        await prisma.listEntry.update({ where: { id: cur.id }, data });
        updated++;
      } else skipped++;
    }
  }
  return { imported, updated, skipped };
}

const ANILIST_STATUS: Record<string, ListStatus> = { CURRENT: "WATCHING", PLANNING: "PLANNING", COMPLETED: "COMPLETED", DROPPED: "DROPPED", PAUSED: "PAUSED", REPEATING: "COMPLETED" };

export async function importFromAniList(userId: string, userName: string, overwrite: boolean): Promise<ImportResult | null> {
  const entries = await getAniListUserList(userName);
  if (!entries) return null;
  const items: Incoming[] = entries
    .filter((e) => e.media && ANILIST_STATUS[e.status])
    .map((e) => ({
      anilistId: e.mediaId,
      status: ANILIST_STATUS[e.status],
      score: e.score && e.score > 0 ? Math.min(10, Math.max(1, Math.round(e.score * 2) / 2)) : null,
      progress: e.progress ?? 0,
      rewatching: e.status === "REPEATING",
      rewatchCount: e.repeat ?? 0,
      notes: (e.notes ?? "").slice(0, 2000),
      startedAt: fuzzyDate(e.startedAt),
      completedAt: fuzzyDate(e.completedAt),
      title: pickTitle(e.media.title, "english"),
      coverImage: e.media.coverImage.large,
    }));
  return { ...(await writeEntries(userId, items, overwrite)), unmatched: 0 };
}

const MAL_STATUS: Record<string, ListStatus> = {
  watching: "WATCHING", "1": "WATCHING",
  completed: "COMPLETED", "2": "COMPLETED",
  "on-hold": "PAUSED", "3": "PAUSED",
  dropped: "DROPPED", "4": "DROPPED",
  "plan to watch": "PLANNING", "6": "PLANNING",
};

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? m[1].trim() : "";
}

function malDate(s: string) {
  if (!s || s.startsWith("0000")) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses MyAnimeList's XML export (animelist.xml) and maps MAL ids to AniList ids. */
export async function importFromMal(userId: string, xml: string, overwrite: boolean): Promise<ImportResult> {
  const blocks = xml.match(/<anime>[\s\S]*?<\/anime>/g) ?? [];
  const parsed = blocks
    .map((b) => ({
      malId: Number(tag(b, "series_animedb_id")),
      status: MAL_STATUS[tag(b, "my_status").toLowerCase()],
      score: Number(tag(b, "my_score")) || null,
      progress: Number(tag(b, "my_watched_episodes")) || 0,
      rewatching: tag(b, "my_rewatching") === "1",
      rewatchCount: Number(tag(b, "my_times_watched")) || 0,
      notes: tag(b, "my_comments"),
      startedAt: malDate(tag(b, "my_start_date")),
      completedAt: malDate(tag(b, "my_finish_date")),
    }))
    .filter((p) => p.malId > 0 && p.status);

  const media = await getMediaByMalIds(parsed.map((p) => p.malId));
  const byMal = new Map<number, LightMedia>(media.filter((m) => m.idMal).map((m) => [m.idMal!, m]));
  for (const m of media) saveSnapshot(m).catch(() => {});

  const items: Incoming[] = [];
  let unmatched = 0;
  for (const p of parsed) {
    const m = byMal.get(p.malId);
    if (!m) {
      unmatched++;
      continue;
    }
    items.push({
      anilistId: m.id,
      status: p.status,
      score: p.score ? Math.min(10, Math.max(1, p.score)) : null,
      progress: p.progress,
      rewatching: p.rewatching,
      rewatchCount: p.rewatchCount,
      notes: p.notes.slice(0, 2000),
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      title: pickTitle(m.title, "english"),
      coverImage: m.coverImage.large,
    });
  }
  return { ...(await writeEntries(userId, items, overwrite)), unmatched };
}
