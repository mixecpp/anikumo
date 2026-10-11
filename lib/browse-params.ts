import { SORTS, type BrowseParams } from "./anilist";

export const GENRE_LIST = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo", "Mecha",
  "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
];
export const FORMATS: [string, string][] = [["TV", "TV"], ["TV_SHORT", "TV Short"], ["MOVIE", "Movie"], ["OVA", "OVA"], ["ONA", "ONA"], ["SPECIAL", "Special"]];
export const STATUSES: [string, string][] = [["RELEASING", "Airing"], ["FINISHED", "Finished"], ["NOT_YET_RELEASED", "Upcoming"], ["HIATUS", "Hiatus"]];
export const SEASONS: [string, string][] = [["WINTER", "Winter"], ["SPRING", "Spring"], ["SUMMER", "Summer"], ["FALL", "Fall"]];
export const LENGTHS: [NonNullable<BrowseParams["length"]>, string][] = [["short", "Under 13 eps"], ["standard", "13–26 eps"], ["long", "Long-running"]];
export const DURATIONS: [NonNullable<BrowseParams["duration"]>, string][] = [["short", "Shorts (≤15 min)"], ["standard", "Standard"], ["long", "Long (60+ min)"]];
export const SCORES = [60, 70, 75, 80, 85];
export const SORT_OPTIONS: [string, string][] = [
  ["relevance", "Relevance"],
  ["popularity", "Popularity"],
  ["trending", "Trending"],
  ["score", "Highest rated"],
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["title", "Title A–Z"],
];

/** Curated entry points, each a plain set of browse filters so the URL stays readable and editable. */
export const VIBES: { id: string; label: string; hint: string; params: Partial<BrowseParams> }[] = [
  { id: "comfy", label: "Comfy", hint: "Gentle, healing slice-of-life", params: { tags: ["Iyashikei"], sort: "score" } },
  { id: "mind", label: "Mind-bending", hint: "Psychological and twisty", params: { genres: ["Psychological"], minScore: 75, sort: "score" } },
  { id: "hype", label: "Hype fights", hint: "Big action, bigger moments", params: { genres: ["Action"], tags: ["Shounen"], minScore: 75, sort: "popularity" } },
  { id: "short", label: "Short & sweet", hint: "Great shows under 13 episodes", params: { length: "short", minScore: 75, sort: "score" } },
  { id: "laughs", label: "Laugh out loud", hint: "Top-rated comedies", params: { genres: ["Comedy"], minScore: 78, sort: "score" } },
  { id: "heartbreak", label: "Bring tissues", hint: "Tragic and moving", params: { tags: ["Tragedy"], minScore: 72, sort: "score" } },
  { id: "isekai", label: "Another world", hint: "Isekai adventures", params: { tags: ["Isekai"], sort: "popularity" } },
  { id: "family", label: "Found family", hint: "Unlikely groups, real bonds", params: { tags: ["Found Family"], sort: "score" } },
  { id: "romance", label: "Cozy romance", hint: "Sweet, low-stakes love stories", params: { genres: ["Romance", "Slice of Life"], minScore: 72, sort: "score" } },
  { id: "spooky", label: "Spooky", hint: "Horror and dread", params: { genres: ["Horror"], sort: "score" } },
];

export function currentSeason(date = new Date()) {
  const m = date.getMonth();
  return { season: m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL", year: date.getFullYear() };
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const pick = <T extends string>(v: string | undefined, allowed: [T, string][]) => (v && allowed.some(([k]) => k === v) ? (v as T) : undefined);
const list = (v: string | undefined) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const tagList = (v: string | undefined) => list(v).filter((t) => /^[\p{L}\p{N} '&./-]{1,40}$/u.test(t)).slice(0, 8);

/** Normalises URL search params into validated AniList browse filters. */
export function parseBrowseParams(raw: Raw): BrowseParams {
  const genres = list(one(raw.genre) ?? one(raw.genres))
    .map((g) => GENRE_LIST.find((x) => x.toLowerCase() === g.toLowerCase()))
    .filter((g): g is string => !!g);
  const excludeGenres = list(one(raw.xgenre))
    .map((g) => GENRE_LIST.find((x) => x.toLowerCase() === g.toLowerCase()))
    .filter((g): g is string => !!g && !genres.includes(g));

  let season = one(raw.season)?.toUpperCase();
  let year = Number(one(raw.year)) || undefined;
  if (season === "CURRENT") ({ season, year } = currentSeason());
  if (year && (year < 1940 || year > new Date().getFullYear() + 2)) year = undefined;

  const score = Number(one(raw.score));
  const pop = Number(one(raw.pop));
  const sort = one(raw.sort);
  const tags = tagList(one(raw.tags));
  return {
    q: one(raw.q)?.slice(0, 100),
    genres,
    excludeGenres,
    tags,
    excludeTags: tagList(one(raw.xtags)).filter((t) => !tags.includes(t)),
    year,
    season: pick(season, SEASONS),
    format: pick(one(raw.format)?.toUpperCase(), FORMATS),
    status: pick(one(raw.status)?.toUpperCase(), STATUSES),
    sort: sort && SORTS[sort] ? sort : undefined,
    minScore: Number.isInteger(score) && score >= 10 && score <= 95 ? score : undefined,
    length: pick(one(raw.length), LENGTHS),
    duration: pick(one(raw.duration), DURATIONS),
    maxPopularity: Number.isInteger(pop) && pop > 0 ? Math.min(pop, 1_000_000) : undefined,
    page: Math.min(Math.max(1, Number(one(raw.page)) || 1), 200),
  };
}

/** Serialises filters back into a stable query string (omitting defaults). */
export function browseQuery(p: BrowseParams, overrides: Partial<BrowseParams> = {}) {
  const v = { ...p, ...overrides };
  const qs = new URLSearchParams();
  if (v.q) qs.set("q", v.q);
  if (v.genres?.length) qs.set("genre", v.genres.join(","));
  if (v.excludeGenres?.length) qs.set("xgenre", v.excludeGenres.join(","));
  if (v.tags?.length) qs.set("tags", v.tags.join(","));
  if (v.excludeTags?.length) qs.set("xtags", v.excludeTags.join(","));
  if (v.year) qs.set("year", String(v.year));
  if (v.season) qs.set("season", v.season);
  if (v.format) qs.set("format", v.format);
  if (v.status) qs.set("status", v.status);
  if (v.minScore) qs.set("score", String(v.minScore));
  if (v.length) qs.set("length", v.length);
  if (v.duration) qs.set("duration", v.duration);
  if (v.maxPopularity) qs.set("pop", String(v.maxPopularity));
  if (v.sort) qs.set("sort", v.sort);
  return qs.toString();
}

export function vibeHref(id: string) {
  const vibe = VIBES.find((v) => v.id === id);
  return vibe ? `/browse?${browseQuery(vibe.params as BrowseParams)}` : "/browse";
}
