import { cached } from "./cache";
import { pickTitle, type TitleLang } from "./prefs-shared";

const ENDPOINT = "https://graphql.anilist.co";

export type Title = { romaji: string | null; english: string | null; native: string | null; userPreferred: string };

export type MediaCard = {
  id: number;
  idMal: number | null;
  title: Title;
  coverImage: { extraLarge: string; large: string; color: string | null };
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration?: number | null;
  averageScore: number | null;
  popularity?: number | null;
  seasonYear: number | null;
  season: string | null;
  genres: string[];
  description?: string | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
};

export type MediaTag = { id: number; name: string; rank: number; isMediaSpoiler: boolean; category: string };

export type MediaDetail = MediaCard & {
  description: string | null;
  duration: number | null;
  source: string | null;
  popularity: number | null;
  synonyms: string[];
  startDate: { year: number | null; month: number | null; day: number | null };
  studios: { nodes: { id: number; name: string }[] };
  trailer: { id: string; site: string } | null;
  streamingEpisodes: { title: string; thumbnail: string; url: string; site: string }[];
  externalLinks: { url: string; site: string; type: string; icon: string | null; color: string | null }[];
  relations: { edges: { relationType: string; node: MediaCard & { type: string } }[] };
  recommendations: { nodes: { mediaRecommendation: MediaCard | null }[] };
  characters: {
    edges: {
      role: string;
      node: { id: number; name: { full: string }; image: { large: string } };
      voiceActors: { id: number; name: { full: string }; image: { large: string } }[];
    }[];
  };
  tags: MediaTag[];
};

const CARD = `
fragment card on Media {
  id idMal
  title { romaji english native userPreferred }
  coverImage { extraLarge large color }
  bannerImage format status episodes duration averageScore popularity seasonYear season genres
  nextAiringEpisode { episode airingAt }
}`;

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  // AniList treats an explicit null as a filter value (e.g. search: null matches nothing), so drop empties.
  const vars = Object.fromEntries(
    Object.entries(variables).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: vars }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 2);
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
      continue;
    }
    const json = await res.json();
    if (json.errors?.length) {
      // A missing user/media is a normal outcome, not an outage.
      if (json.errors[0].status === 404) return (json.data ?? {}) as T;
      throw new Error(`AniList: ${json.errors[0].message}`);
    }
    return json.data as T;
  }
  throw new Error("AniList rate limit — try again in a minute");
}

export const SEASON_ORDER = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;

export function currentSeason(date = new Date()): { season: string; year: number } {
  const m = date.getMonth();
  return { season: SEASON_ORDER[Math.floor(m / 3)], year: date.getFullYear() };
}

export function shiftSeason(season: string, year: number, by: number) {
  const idx = SEASON_ORDER.indexOf(season as (typeof SEASON_ORDER)[number]) + by;
  return { season: SEASON_ORDER[((idx % 4) + 4) % 4], year: year + Math.floor(idx / 4) };
}

export async function getHomeData() {
  const { season, year } = currentSeason();
  return cached(`home:${season}:${year}`, 60 * 30, () =>
    gql<{
      trending: { media: MediaCard[] };
      seasonal: { media: MediaCard[] };
      popular: { media: MediaCard[] };
      top: { media: MediaCard[] };
    }>(
      `query ($season: MediaSeason, $year: Int) {
        trending: Page(perPage: 20) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ...card description(asHtml: false) } }
        seasonal: Page(perPage: 20) { media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ...card } }
        popular: Page(perPage: 20) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ...card } }
        top: Page(perPage: 20) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ...card } }
      }
      ${CARD}`,
      { season, year },
    ),
  );
}

export type BrowseParams = {
  q?: string;
  genres?: string[];
  excludeGenres?: string[];
  tags?: string[];
  excludeTags?: string[];
  year?: number;
  season?: string;
  format?: string;
  status?: string;
  sort?: string;
  minScore?: number;
  length?: "short" | "standard" | "long";
  duration?: "short" | "standard" | "long";
  maxPopularity?: number;
  page?: number;
};

export const SORTS: Record<string, string> = {
  relevance: "SEARCH_MATCH",
  popularity: "POPULARITY_DESC",
  trending: "TRENDING_DESC",
  score: "SCORE_DESC",
  newest: "START_DATE_DESC",
  oldest: "START_DATE",
  title: "TITLE_ROMAJI",
};

export const BROWSE_PAGE_SIZE = 30;

const LENGTHS = { short: [undefined, 13], standard: [12, 27], long: [26, undefined] } as const;
const DURATIONS = { short: [undefined, 16], standard: [15, 61], long: [60, undefined] } as const;

const BROWSE_QUERY = `query ($search: String, $genres: [String], $notGenres: [String], $tags: [String], $notTags: [String], $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort], $page: Int, $perPage: Int, $minScore: Int, $epGt: Int, $epLt: Int, $durGt: Int, $durLt: Int, $popLt: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage total lastPage }
    media(type: ANIME, isAdult: false, search: $search, genre_in: $genres, genre_not_in: $notGenres, tag_in: $tags, tag_not_in: $notTags, seasonYear: $year, season: $season, format: $format, status: $status, sort: $sort, averageScore_greater: $minScore, episodes_greater: $epGt, episodes_lesser: $epLt, duration_greater: $durGt, duration_lesser: $durLt, popularity_lesser: $popLt) { ...card }
  }
}
${CARD}`;

function browseVars(p: BrowseParams, page: number, perPage: number) {
  const sortKey = p.sort && SORTS[p.sort] ? p.sort : p.q ? "relevance" : "popularity";
  // SEARCH_MATCH only means something with a search term; fall back to popularity without one.
  const sort = sortKey === "relevance" && !p.q ? "POPULARITY_DESC" : SORTS[sortKey];
  const len = p.length ? LENGTHS[p.length] : [undefined, undefined];
  const dur = p.duration ? DURATIONS[p.duration] : [undefined, undefined];
  return {
    search: p.q,
    genres: p.genres?.length ? p.genres : undefined,
    notGenres: p.excludeGenres?.length ? p.excludeGenres : undefined,
    tags: p.tags?.length ? p.tags : undefined,
    notTags: p.excludeTags?.length ? p.excludeTags : undefined,
    year: p.year,
    season: p.season,
    format: p.format,
    status: p.status,
    sort: p.q && sort !== "SEARCH_MATCH" ? [sort, "SEARCH_MATCH"] : [sort],
    minScore: p.minScore ? p.minScore - 1 : undefined,
    epGt: len[0],
    epLt: len[1],
    durGt: dur[0],
    durLt: dur[1],
    popLt: p.maxPopularity,
    page,
    perPage,
  };
}

type BrowsePage = { Page: { pageInfo: { hasNextPage: boolean; currentPage: number; total: number; lastPage: number }; media: MediaCard[] } };

export async function browse(p: BrowseParams) {
  const vars = browseVars(p, p.page || 1, BROWSE_PAGE_SIZE);
  return cached(`browse:${JSON.stringify(vars)}`, 60 * 30, async () => {
    const data = await gql<BrowsePage>(BROWSE_QUERY, vars);
    return { media: data.Page.media, hasNextPage: data.Page.pageInfo.hasNextPage, page: data.Page.pageInfo.currentPage };
  });
}

/** A uniformly random title matching the filters (two cheap requests). */
export async function randomPick(p: BrowseParams): Promise<MediaCard | null> {
  const base = { ...p, sort: p.sort ?? "popularity", q: p.q };
  const head = await cached(`rand-head:${JSON.stringify(browseVars(base, 1, 1))}`, 60 * 30, () => gql<BrowsePage>(BROWSE_QUERY, browseVars(base, 1, 1)));
  const total = Math.min(head.Page.pageInfo.total ?? 0, 5000);
  if (!total) return null;
  const page = 1 + Math.floor(Math.random() * total);
  const data = await gql<BrowsePage>(BROWSE_QUERY, browseVars(base, page, 1));
  return data.Page.media[0] ?? head.Page.media[0] ?? null;
}

export async function quickSearch(q: string) {
  return cached(`qs:${q.toLowerCase()}`, 60 * 60, async () => {
    const data = await gql<{ Page: { media: MediaCard[] } }>(
      `query ($q: String) { Page(perPage: 8) { media(type: ANIME, search: $q, isAdult: false, sort: SEARCH_MATCH) { ...card } } }
      ${CARD}`,
      { q },
    );
    return data.Page.media;
  });
}

export type SearchHit = {
  anime: (Pick<MediaCard, "id" | "title" | "format" | "seasonYear" | "episodes"> & { coverImage: { large: string } })[];
  characters: { id: number; name: { full: string; native: string | null }; image: { large: string }; media: { nodes: { title: Title }[] } }[];
  staff: { id: number; name: { full: string; native: string | null }; image: { large: string }; primaryOccupations: string[] }[];
  studios: { id: number; name: string; isAnimationStudio: boolean }[];
};

/** One round trip for the search box: anime, characters, staff and studios, best matches first. */
export async function searchEverything(q: string): Promise<SearchHit> {
  return cached(`search:${q.toLowerCase()}`, 60 * 10, async () => {
    const data = await gql<{ anime: { media: SearchHit["anime"] }; characters: { characters: SearchHit["characters"] }; staff: { staff: SearchHit["staff"] }; studios: { studios: SearchHit["studios"] } }>(
      `query ($q: String) {
        anime: Page(perPage: 6) { media(type: ANIME, search: $q, isAdult: false, sort: SEARCH_MATCH) { id title { romaji english native userPreferred } coverImage { large } format seasonYear episodes } }
        characters: Page(perPage: 3) { characters(search: $q, sort: SEARCH_MATCH) { id name { full native } image { large } media(perPage: 1, sort: POPULARITY_DESC, type: ANIME) { nodes { title { romaji english native userPreferred } } } } }
        staff: Page(perPage: 2) { staff(search: $q, sort: SEARCH_MATCH) { id name { full native } image { large } primaryOccupations } }
        studios: Page(perPage: 2) { studios(search: $q, sort: SEARCH_MATCH) { id name isAnimationStudio } }
      }`,
      { q },
    );
    return {
      anime: data.anime?.media ?? [],
      characters: data.characters?.characters ?? [],
      staff: data.staff?.staff ?? [],
      studios: (data.studios?.studios ?? []).filter((x) => x.isAnimationStudio),
    };
  });
}

export async function getMedia(id: number) {
  return cached(`media:${id}`, 60 * 60 * 6, async () => {
    const data = await gql<{ Media: MediaDetail | null }>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          ...card
          description(asHtml: false)
          duration source popularity synonyms
          startDate { year month day }
          studios(isMain: true) { nodes { id name } }
          trailer { id site }
          streamingEpisodes { title thumbnail url site }
          externalLinks { url site type icon color }
          tags { id name rank isMediaSpoiler category }
          relations { edges { relationType node { ...card type } } }
          recommendations(sort: RATING_DESC, perPage: 14) { nodes { mediaRecommendation { ...card } } }
          characters(sort: [ROLE, RELEVANCE], perPage: 12) {
            edges {
              role
              node { id name { full } image { large } }
              voiceActors(language: JAPANESE) { id name { full } image { large } }
            }
          }
        }
      }
      ${CARD}`,
      { id },
    );
    if (data.Media) {
      const { saveSnapshot } = await import("./media");
      saveSnapshot(data.Media).catch(() => {});
    }
    return data.Media ?? null;
  });
}

export async function getSchedule(fromUnix: number, toUnix: number) {
  return cached(`sched:${fromUnix}:${toUnix}`, 60 * 15, async () => {
    type Item = { id: number; airingAt: number; episode: number; media: MediaCard & { isAdult: boolean } };
    const all: Item[] = [];
    for (let page = 1; page <= 4; page++) {
      const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: Item[] } }>(
        `query ($from: Int, $to: Int, $page: Int) {
          Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
              id airingAt episode media { ...card isAdult }
            }
          }
        }
        ${CARD}`,
        { from: fromUnix, to: toUnix, page },
      );
      all.push(...data.Page.airingSchedules);
      if (!data.Page.pageInfo.hasNextPage) break;
    }
    return all.filter((s) => !s.media.isAdult);
  });
}

/** Airing slots for specific shows (calendar export). */
export async function getScheduleFor(ids: number[], fromUnix: number, toUnix: number) {
  if (!ids.length) return [];
  type Item = { id: number; airingAt: number; episode: number; media: { id: number; title: Title; duration: number | null } };
  const key = `sched-for:${[...ids].sort((a, b) => a - b).join(",")}:${Math.floor(fromUnix / 3600)}:${Math.floor(toUnix / 3600)}`;
  return cached(key, 60 * 30, async () => {
    const all: Item[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const data = await gql<{ Page: { airingSchedules: Item[] } }>(
        `query ($ids: [Int], $from: Int, $to: Int) {
          Page(perPage: 50) {
            airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
              id airingAt episode media { id title { romaji english native userPreferred } duration }
            }
          }
        }`,
        { ids: ids.slice(i, i + 50), from: fromUnix, to: toUnix },
      );
      all.push(...data.Page.airingSchedules);
    }
    return all.sort((a, b) => a.airingAt - b.airingAt);
  });
}

export type SeasonMedia = MediaCard & {
  startDate: { year: number | null; month: number | null; day: number | null };
  trailer: { id: string; site: string; thumbnail: string | null } | null;
  studios: { nodes: { id: number; name: string }[] };
  description: string | null;
};

export async function getSeason(season: string, year: number) {
  return cached(`season:${season}:${year}`, 60 * 60, async () => {
    const all: SeasonMedia[] = [];
    for (let page = 1; page <= 4; page++) {
      const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: SeasonMedia[] } }>(
        `query ($season: MediaSeason, $year: Int, $page: Int) {
          Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            media(type: ANIME, season: $season, seasonYear: $year, isAdult: false, sort: POPULARITY_DESC) {
              ...card
              description(asHtml: false)
              startDate { year month day }
              trailer { id site thumbnail }
              studios(isMain: true) { nodes { id name } }
            }
          }
        }
        ${CARD}`,
        { season, year, page },
      );
      all.push(...data.Page.media);
      if (!data.Page.pageInfo.hasNextPage) break;
    }
    return all;
  });
}

export async function getTopChart(opts: { genre?: string; year?: number; gems?: boolean }) {
  const key = `chart:${JSON.stringify(opts)}`;
  return cached(key, 60 * 60 * 3, async () => {
    const all: MediaCard[] = [];
    for (let page = 1; page <= 2; page++) {
      const data = await gql<{ Page: { media: MediaCard[] } }>(
        `query ($page: Int, $genre: String, $year: Int, $popLt: Int, $popGt: Int, $minScore: Int) {
          Page(page: $page, perPage: 50) {
            media(type: ANIME, isAdult: false, sort: [SCORE_DESC, POPULARITY_DESC], genre: $genre, seasonYear: $year, popularity_lesser: $popLt, popularity_greater: $popGt, averageScore_greater: $minScore) { ...card }
          }
        }
        ${CARD}`,
        {
          page,
          genre: opts.genre,
          year: opts.year,
          popLt: opts.gems ? 40000 : undefined,
          popGt: opts.gems ? 1500 : 5000,
          minScore: opts.gems ? 74 : undefined,
        },
      );
      all.push(...data.Page.media);
    }
    return all;
  });
}

export async function similarByTags(id: number, tags: string[]) {
  if (!tags.length) return [];
  return cached(`similar:${id}:${tags.join("|")}`, 60 * 60 * 6, async () => {
    const data = await gql<{ Page: { media: MediaCard[] } }>(
      `query ($id: Int, $tags: [String]) {
        Page(perPage: 16) { media(type: ANIME, isAdult: false, id_not: $id, tag_in: $tags, sort: [SCORE_DESC], popularity_greater: 3000) { ...card } }
      }
      ${CARD}`,
      { id, tags },
    );
    return data.Page.media;
  });
}

export type CharacterDetail = {
  id: number;
  name: { full: string; native: string | null; alternative: string[] };
  image: { large: string };
  description: string | null;
  gender: string | null;
  age: string | null;
  dateOfBirth: { year: number | null; month: number | null; day: number | null };
  favourites: number | null;
  media: { edges: { characterRole: string; node: MediaCard; voiceActors: { id: number; name: { full: string }; image: { large: string } }[] }[] };
};

export async function getCharacter(id: number) {
  return cached(`char:${id}`, 60 * 60 * 12, async () => {
    const data = await gql<{ Character: CharacterDetail | null }>(
      `query ($id: Int) {
        Character(id: $id) {
          id name { full native alternative } image { large } description(asHtml: false) gender age
          dateOfBirth { year month day } favourites
          media(sort: POPULARITY_DESC, perPage: 25, type: ANIME) {
            edges { characterRole node { ...card } voiceActors(language: JAPANESE) { id name { full } image { large } } }
          }
        }
      }
      ${CARD}`,
      { id },
    );
    return data.Character ?? null;
  });
}

export type StaffDetail = {
  id: number;
  name: { full: string; native: string | null };
  image: { large: string };
  description: string | null;
  primaryOccupations: string[];
  languageV2: string | null;
  homeTown: string | null;
  dateOfBirth: { year: number | null; month: number | null; day: number | null };
  favourites: number | null;
  characterMedia: { edges: { characterRole: string; node: MediaCard; characters: { id: number; name: { full: string }; image: { large: string } }[] }[] };
  staffMedia: { edges: { staffRole: string; node: MediaCard }[] };
};

export async function getStaff(id: number) {
  return cached(`staff:${id}`, 60 * 60 * 12, async () => {
    const data = await gql<{ Staff: StaffDetail | null }>(
      `query ($id: Int) {
        Staff(id: $id) {
          id name { full native } image { large } description(asHtml: false) primaryOccupations languageV2 homeTown
          dateOfBirth { year month day } favourites
          characterMedia(sort: POPULARITY_DESC, perPage: 30) {
            edges { characterRole node { ...card } characters { id name { full } image { large } } }
          }
          staffMedia(type: ANIME, sort: POPULARITY_DESC, perPage: 20) { edges { staffRole node { ...card } } }
        }
      }
      ${CARD}`,
      { id },
    );
    return data.Staff ?? null;
  });
}

export type StudioDetail = { id: number; name: string; isAnimationStudio: boolean; favourites: number | null; media: { nodes: MediaCard[] } };

export async function getStudio(id: number) {
  return cached(`studio:${id}`, 60 * 60 * 12, async () => {
    const data = await gql<{ Studio: StudioDetail | null }>(
      `query ($id: Int) {
        Studio(id: $id) {
          id name isAnimationStudio favourites
          media(sort: START_DATE_DESC, isMain: true, perPage: 50) { nodes { ...card } }
        }
      }
      ${CARD}`,
      { id },
    );
    if (data.Studio) data.Studio.media.nodes = data.Studio.media.nodes.filter((m) => m && m.id);
    return data.Studio ?? null;
  });
}

export type RelationNode = {
  id: number;
  type: string;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  title: Title;
  coverImage: { large: string };
  relations: { edges: { relationType: string; node: { id: number; type: string; format: string | null } }[] };
};

export async function getRelationNode(id: number) {
  return cached(`rel:${id}`, 60 * 60 * 24, async () => {
    const data = await gql<{ Media: RelationNode | null }>(
      `query ($id: Int) {
        Media(id: $id) {
          id type format status episodes duration startDate { year month day }
          title { romaji english native userPreferred } coverImage { large }
          relations { edges { relationType node { id type format } } }
        }
      }`,
      { id },
    );
    return data.Media ?? null;
  });
}

export type LightMedia = {
  id: number;
  idMal: number | null;
  title: Title;
  coverImage: { large: string };
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  genres: string[];
  season: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  isAdult: boolean;
  studios: { nodes: { name: string }[] };
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[];
  nextAiringEpisode: { episode: number; airingAt: number } | null;
};

const LIGHT_FIELDS = `id idMal title { romaji english native userPreferred } coverImage { large } bannerImage format status episodes duration genres season seasonYear averageScore isAdult
  studios(isMain: true) { nodes { name } } tags { name rank isMediaSpoiler } nextAiringEpisode { episode airingAt }`;

/** Batched lookup by AniList id (50 per request). */
export async function getMediaBatch(ids: number[]): Promise<LightMedia[]> {
  const out: LightMedia[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const data = await gql<{ Page: { media: LightMedia[] } }>(
      `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${LIGHT_FIELDS} } } }`,
      { ids: unique.slice(i, i + 50) },
    );
    out.push(...data.Page.media);
  }
  return out;
}

/** Batched lookup by MyAnimeList id, for MAL imports. */
export async function getMediaByMalIds(malIds: number[]): Promise<LightMedia[]> {
  const out: LightMedia[] = [];
  const unique = [...new Set(malIds)];
  for (let i = 0; i < unique.length; i += 50) {
    const data = await gql<{ Page: { media: LightMedia[] } }>(
      `query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { ${LIGHT_FIELDS} } } }`,
      { ids: unique.slice(i, i + 50) },
    );
    out.push(...data.Page.media);
  }
  return out;
}

export async function getTagCollection() {
  return cached("tags", 60 * 60 * 24, async () => {
    const data = await gql<{ MediaTagCollection: { name: string; category: string; isAdult: boolean; description: string }[] }>(
      `query { MediaTagCollection { name category isAdult description } }`,
    );
    return data.MediaTagCollection.filter((t) => !t.isAdult).map((t) => ({ name: t.name, category: t.category, description: t.description }));
  });
}

export type AniListImportEntry = {
  mediaId: number;
  status: string;
  score: number | null;
  progress: number | null;
  repeat: number | null;
  notes: string | null;
  startedAt: { year: number | null; month: number | null; day: number | null };
  completedAt: { year: number | null; month: number | null; day: number | null };
  media: { id: number; title: Title; coverImage: { large: string }; episodes: number | null };
};

export async function getAniListUserList(userName: string) {
  const data = await gql<{ MediaListCollection: { lists: { entries: AniListImportEntry[] }[] } | null }>(
    `query ($name: String) {
      MediaListCollection(userName: $name, type: ANIME) {
        lists {
          entries {
            mediaId status score(format: POINT_10_DECIMAL) progress repeat notes
            startedAt { year month day } completedAt { year month day }
            media { id title { romaji english native userPreferred } coverImage { large } episodes }
          }
        }
      }
    }`,
    { name: userName },
  );
  return data.MediaListCollection?.lists.flatMap((l) => l.entries) ?? null;
}

export const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo", "Mecha",
  "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
];

export function titleOf(m: { title: Partial<Title> & { userPreferred?: string | null } }, lang: TitleLang = "english") {
  return pickTitle(m.title, lang);
}

/** Episodes that exist right now (aired), used to build the episode grid. */
export function availableEpisodeCount(m: Pick<MediaCard, "episodes" | "nextAiringEpisode" | "status">) {
  if (m.nextAiringEpisode) return Math.max(0, m.nextAiringEpisode.episode - 1);
  if (m.status === "NOT_YET_RELEASED") return 0;
  return m.episodes ?? 1;
}

export function stripHtml(s: string | null | undefined) {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/~!|!~/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function prettyEnum(s: string | null | undefined) {
  if (!s) return "";
  if (s === "TV_SHORT") return "TV Short";
  if (["TV", "OVA", "ONA"].includes(s)) return s;
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

export function fuzzyDate(d: { year: number | null; month: number | null; day: number | null } | null | undefined) {
  if (!d?.year) return null;
  return new Date(d.year, (d.month ?? 1) - 1, d.day ?? 1);
}
