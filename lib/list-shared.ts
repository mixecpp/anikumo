export const LIST_STATUSES = ["WATCHING", "PLANNING", "COMPLETED", "PAUSED", "DROPPED"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

export const STATUS_LABEL: Record<ListStatus, string> = {
  WATCHING: "Watching",
  PLANNING: "Plan to watch",
  COMPLETED: "Completed",
  PAUSED: "On hold",
  DROPPED: "Dropped",
};

export const STATUS_DOT: Record<ListStatus, string> = {
  WATCHING: "bg-success",
  PLANNING: "bg-sky-400",
  COMPLETED: "bg-violet",
  PAUSED: "bg-amber-400",
  DROPPED: "bg-red-400",
};

export function isStatus(v: unknown): v is ListStatus {
  return typeof v === "string" && (LIST_STATUSES as readonly string[]).includes(v);
}

export type ListEntryDTO = {
  anilistId: number;
  status: ListStatus;
  score: number | null;
  progress: number;
  notes: string;
  tags: string[];
  pinned: boolean;
  hiddenFromContinue: boolean;
  rewatching: boolean;
  rewatchCount: number;
  rewatchEpisode: number;
  startedAt: string | null;
  completedAt: string | null;
  title: string;
  coverImage: string;
  updatedAt: string;
};

export function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const tag = t.trim().replace(/\s+/g, " ").slice(0, 24);
    if (tag) out.add(tag.toLowerCase());
    if (out.size >= 12) break;
  }
  return [...out];
}
