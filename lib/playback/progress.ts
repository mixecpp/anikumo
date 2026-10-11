export type ProgressInput = {
  anilistId: number; episode: number; progressSeconds?: number; durationSeconds?: number;
  completed?: boolean; sampledAt: number; title: string; coverImage: string;
  expectedUserId?: string;
};

export function positiveId(value: unknown): number | null {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

export function parseProgress(value: unknown, now = Date.now()): ProgressInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected progress object");
  const b = value as Record<string, unknown>;
  const anilistId = positiveId(b.anilistId), episode = positiveId(b.episode);
  if (!anilistId || !episode) throw new Error("anilistId and episode must be positive integers");
  for (const key of ["progressSeconds", "durationSeconds"] as const) {
    if (b[key] !== undefined && (typeof b[key] !== "number" || !Number.isFinite(b[key]) || b[key] < 0 || b[key] > 86400)) throw new Error(`${key} must be a valid number of seconds`);
  }
  if (b.completed !== undefined && typeof b.completed !== "boolean") throw new Error("completed must be boolean");
  if (b.completed === undefined && (b.progressSeconds === undefined || b.durationSeconds === undefined || b.durationSeconds === 0)) throw new Error("Playback position and duration are required");
  const sampledAt = b.sampledAt ?? now;
  if (typeof sampledAt !== "number" || !Number.isSafeInteger(sampledAt) || sampledAt < 0 || sampledAt > now + 300_000) throw new Error("Invalid sample time");
  return { anilistId, episode, progressSeconds: b.progressSeconds as number | undefined, durationSeconds: b.durationSeconds as number | undefined, completed: b.completed as boolean | undefined, sampledAt, expectedUserId: typeof b.expectedUserId === "string" ? b.expectedUserId : undefined, title: typeof b.title === "string" ? b.title.slice(0, 300) : "", coverImage: typeof b.coverImage === "string" && /^https:\/\//.test(b.coverImage) ? b.coverImage.slice(0, 1000) : "" };
}

export function mergeProgress(input: ProgressInput, previous: { progressSeconds: number; durationSeconds: number; completed: boolean } | null) {
  const durationSeconds = input.durationSeconds && input.durationSeconds > 0 ? input.durationSeconds : previous?.durationSeconds ?? 0;
  const position = input.progressSeconds ?? previous?.progressSeconds ?? 0;
  const progressSeconds = durationSeconds > 0 ? Math.min(position, durationSeconds) : position;
  // Infer completion when playback reaches the end, not on every poll of an already-finished position.
  // This lets a manual unmark stay unwatched until the episode is watched again.
  const nearEnd = durationSeconds > 0 && progressSeconds >= durationSeconds * 0.95;
  const wasNearEnd = !!previous && previous.durationSeconds > 0 && previous.progressSeconds >= previous.durationSeconds * 0.95;
  const completed = input.completed ?? (previous?.completed === true || (nearEnd && !wasNearEnd));
  return { progressSeconds, durationSeconds, completed };
}
