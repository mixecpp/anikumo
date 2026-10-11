import { prisma } from "./db";
import { getSnapshots } from "./media";
import { cleanTags, isStatus, type ListEntryDTO, type ListStatus } from "./list-shared";

type Row = Awaited<ReturnType<typeof prisma.listEntry.findFirstOrThrow>>;

export function toDTO(r: Row, watchedUpTo = 0): ListEntryDTO {
  let tags: string[] = [];
  try {
    tags = cleanTags(JSON.parse(r.tags));
  } catch {}
  return {
    anilistId: r.anilistId,
    status: (isStatus(r.status) ? r.status : "PLANNING") as ListStatus,
    score: r.score,
    progress: Math.max(r.progress, watchedUpTo),
    notes: r.notes,
    tags,
    pinned: r.pinned,
    hiddenFromContinue: r.hiddenFromContinue,
    rewatching: r.rewatching,
    rewatchCount: r.rewatchCount,
    rewatchEpisode: r.rewatchEpisode,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    title: r.title,
    coverImage: r.coverImage,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Highest completed episode per show from watch history. */
export async function watchedUpTo(userId: string, anilistIds?: number[]) {
  const rows = await prisma.watchProgress.groupBy({
    by: ["anilistId"],
    where: { userId, completed: true, ...(anilistIds ? { anilistId: { in: anilistIds } } : {}) },
    _max: { episode: true },
  });
  return new Map(rows.map((r) => [r.anilistId, r._max.episode ?? 0]));
}

export type EntryPatch = {
  status?: ListStatus;
  score?: number | null;
  progress?: number;
  notes?: string;
  tags?: string[];
  pinned?: boolean;
  hiddenFromContinue?: boolean;
  rewatching?: boolean;
  rewatchEpisode?: number;
  title?: string;
  coverImage?: string;
};

export function validatePatch(body: Record<string, unknown>): EntryPatch | string {
  const p: EntryPatch = {};
  if (body.status !== undefined) {
    if (!isStatus(body.status)) return "Invalid status";
    p.status = body.status;
  }
  if (body.score !== undefined) {
    if (body.score === null) p.score = null;
    else {
      const s = Number(body.score);
      if (!Number.isFinite(s) || s < 1 || s > 10) return "Score must be between 1 and 10";
      p.score = Math.round(s * 2) / 2;
    }
  }
  if (body.progress !== undefined) {
    const n = Number(body.progress);
    if (!Number.isSafeInteger(n) || n < 0 || n > 100000) return "Invalid progress";
    p.progress = n;
  }
  if (body.notes !== undefined) p.notes = String(body.notes).slice(0, 2000);
  if (body.tags !== undefined) p.tags = cleanTags(body.tags);
  for (const k of ["pinned", "hiddenFromContinue", "rewatching"] as const) {
    if (body[k] !== undefined) p[k] = body[k] === true;
  }
  if (body.rewatchEpisode !== undefined) {
    const n = Number(body.rewatchEpisode);
    if (!Number.isSafeInteger(n) || n < 0 || n > 100000) return "Invalid rewatch episode";
    p.rewatchEpisode = n;
  }
  if (body.title !== undefined) p.title = String(body.title).slice(0, 300);
  if (body.coverImage !== undefined) p.coverImage = String(body.coverImage).slice(0, 500);
  return p;
}

/** Creates or updates an entry, keeping start/complete dates and rewatch counters consistent. */
export async function upsertEntry(userId: string, anilistId: number, patch: EntryPatch) {
  const existing = await prisma.listEntry.findUnique({ where: { userId_anilistId: { userId, anilistId } } });
  let title = patch.title ?? existing?.title;
  let coverImage = patch.coverImage ?? existing?.coverImage;
  let total: number | null = null;
  if (!title || !coverImage || patch.status === "COMPLETED" || patch.rewatching !== undefined) {
    const snap = (await getSnapshots([anilistId])).get(anilistId);
    title ||= snap?.title ?? "Untitled";
    coverImage ||= snap?.coverImage ?? "";
    total = snap?.episodes ?? null;
  }

  const now = new Date();
  const data: Record<string, unknown> = { title, coverImage };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined && k !== "title" && k !== "coverImage") data[k] = k === "tags" ? JSON.stringify(v) : v;

  const nextStatus = patch.status ?? existing?.status;
  if (nextStatus === "WATCHING" && !existing?.startedAt) data.startedAt = now;
  if (patch.status === "COMPLETED" && existing?.status !== "COMPLETED") {
    data.completedAt = now;
    if (!existing?.startedAt) data.startedAt = now;
    if (total && (patch.progress ?? existing?.progress ?? 0) < total) data.progress = total;
  }
  if (patch.rewatching === true && !existing?.rewatching) {
    data.rewatchEpisode = patch.rewatchEpisode ?? 0;
  }
  if (patch.rewatching === false && existing?.rewatching && total && (existing.rewatchEpisode ?? 0) >= total) {
    data.rewatchCount = (existing.rewatchCount ?? 0) + 1;
  }

  const row = await prisma.listEntry.upsert({
    where: { userId_anilistId: { userId, anilistId } },
    create: { userId, anilistId, status: nextStatus ?? "PLANNING", title: title!, coverImage: coverImage!, ...(data as object) },
    update: data,
  });
  return row;
}

/** Records one rewatched episode; finishing the last one closes the rewatch and bumps the counter. */
export async function advanceRewatch(userId: string, anilistId: number, episode: number) {
  const entry = await prisma.listEntry.findUnique({ where: { userId_anilistId: { userId, anilistId } } });
  if (!entry?.rewatching || episode <= entry.rewatchEpisode) return entry;
  const total = (await getSnapshots([anilistId])).get(anilistId)?.episodes ?? null;
  const finished = total !== null && episode >= total;
  return prisma.listEntry.update({
    where: { id: entry.id },
    data: finished ? { rewatchEpisode: 0, rewatching: false, rewatchCount: entry.rewatchCount + 1 } : { rewatchEpisode: episode },
  });
}

const syncedAt = new Map<string, number>();

/**
 * Keeps the list in step with watch history: shows you've started become "Watching",
 * progress follows your highest finished episode, and finished series auto-complete.
 */
export async function syncListFromProgress(userId: string, force = false) {
  const last = syncedAt.get(userId) ?? 0;
  if (!force && Date.now() - last < 60_000) return;
  syncedAt.set(userId, Date.now());

  const [entries, upTo, started] = await Promise.all([
    prisma.listEntry.findMany({ where: { userId } }),
    watchedUpTo(userId),
    prisma.watchProgress.findMany({ where: { userId }, distinct: ["anilistId"], select: { anilistId: true, title: true, coverImage: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  const byId = new Map(entries.map((e) => [e.anilistId, e]));
  const snaps = await getSnapshots([...new Set([...started.map((s) => s.anilistId), ...entries.map((e) => e.anilistId)])]);

  for (const s of started) {
    const existing = byId.get(s.anilistId);
    const watched = upTo.get(s.anilistId) ?? 0;
    const snap = snaps.get(s.anilistId);
    const total = snap?.episodes ?? null;
    const done = total !== null && watched >= total && snap?.status === "FINISHED";
    if (!existing) {
      await prisma.listEntry.create({
        data: {
          userId,
          anilistId: s.anilistId,
          status: done ? "COMPLETED" : "WATCHING",
          progress: watched,
          title: snap?.title ?? s.title,
          coverImage: snap?.coverImage ?? s.coverImage,
          startedAt: new Date(),
          completedAt: done ? new Date() : null,
        },
      });
      continue;
    }
    const data: Record<string, unknown> = {};
    if (watched > existing.progress) data.progress = watched;
    if (existing.status === "PLANNING" && watched > 0) {
      data.status = "WATCHING";
      data.startedAt = existing.startedAt ?? new Date();
    }
    if (done && (existing.status === "WATCHING" || existing.status === "PLANNING")) {
      data.status = "COMPLETED";
      data.completedAt = new Date();
    }
    if (Object.keys(data).length) await prisma.listEntry.update({ where: { id: existing.id }, data });
  }
}

export async function getList(userId: string) {
  await syncListFromProgress(userId);
  const [rows, upTo] = await Promise.all([prisma.listEntry.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }), watchedUpTo(userId)]);
  return rows.map((r) => toDTO(r, upTo.get(r.anilistId) ?? 0));
}

export async function getEntryDTO(userId: string | null, anilistId: number) {
  if (!userId) return null;
  const [row, upTo] = await Promise.all([prisma.listEntry.findUnique({ where: { userId_anilistId: { userId, anilistId } } }), watchedUpTo(userId, [anilistId])]);
  return row ? toDTO(row, upTo.get(anilistId) ?? 0) : null;
}

/** Map of anilistId → status for decorating cards (seasonal chart, compare, etc.). */
export async function statusMap(userId: string | null) {
  if (!userId) return {} as Record<number, ListStatus>;
  const rows = await prisma.listEntry.findMany({ where: { userId }, select: { anilistId: true, status: true } });
  return Object.fromEntries(rows.filter((r) => isStatus(r.status)).map((r) => [r.anilistId, r.status as ListStatus]));
}
