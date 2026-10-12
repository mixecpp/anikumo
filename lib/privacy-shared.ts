/**
 * Profile privacy. Who can open the profile at all (visibility), which sections they see,
 * and whether the person shows up in search, on the leaderboard, and can be followed.
 * Shared with client components; the database check lives in lib/privacy.ts.
 */
export type Visibility = "everyone" | "followers" | "private";
export const VISIBILITIES: { value: Visibility; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "Anyone with the link, and search engines" },
  { value: "followers", label: "Followers", hint: "Only people who follow you" },
  { value: "private", label: "Only me", hint: "Nobody else can open it" },
];

export type WallSetting = "everyone" | "followers" | "off";
export const WALL_SETTINGS: { value: WallSetting; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "Anyone who can see your profile" },
  { value: "followers", label: "Followers", hint: "Only people who follow you" },
  { value: "off", label: "Nobody", hint: "Hide comments on your profile" },
];
export const isWallSetting = (v: unknown): v is WallSetting => v === "everyone" || v === "followers" || v === "off";

export const SECTIONS = {
  posts: "Posts",
  stats: "Stats (watch time, episodes, streaks)",
  achievements: "Achievements",
  watching: "Currently watching",
  favorites: "Favourites",
  completed: "Completed shows",
  lists: "Public custom lists",
  reviews: "Reviews",
  comments: "Comment history",
  follows: "Follower and following counts",
} as const;
export type Section = keyof typeof SECTIONS;
export type Sections = Record<Section, boolean>;

export function isVisibility(v: unknown): v is Visibility {
  return v === "everyone" || v === "followers" || v === "private";
}

/** Every section is shown unless the person switched it off. */
export function parseSections(json: string | null | undefined): Sections {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(json || "{}");
  } catch {}
  return Object.fromEntries((Object.keys(SECTIONS) as Section[]).map((k) => [k, raw[k] !== false])) as Sections;
}

/** Only stores the switched-off sections, so new sections default to on. */
export function serializeSections(input: unknown): string {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const off = (Object.keys(SECTIONS) as Section[]).filter((k) => src[k] === false);
  return JSON.stringify(Object.fromEntries(off.map((k) => [k, false])));
}

/** AniList anime banners only — no uploads, so nothing to moderate. */
export const BANNER_URL = /^https:\/\/s\d\.anilist\.co\/file\/anilistcdn\/media\/anime\/banner\/[\w./-]+$/;
