import { cached } from "./cache";

const ENDPOINT = "https://graphql.anilist.co";

export type MediaCard = {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; userPreferred: string };
  coverImage: { extraLarge: string; large: string; color: string | null };
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  averageScore: number | null;
  seasonYear: number | null;
  season: string | null;
  genres: string[];
  description?: string | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
};

export type MediaDetail = MediaCard & {
  description: string | null;
  duration: number | null;
  source: string | null;
  popularity: number | null;
  synonyms: string[];
  startDate: { year: number | null; month: number | null; day: number | null };
  studios: { nodes: { name: string }[] };
  trailer: { id: string; site: string } | null;
  streamingEpisodes: { title: string; thumbnail: string; url: string; site: string }[];
  externalLinks: { url: string; site: string; type: string; icon: string | null; color: string | null }[];
  relations: { edges: { relationType: string; node: MediaCard & { type: string } }[] };
  recommendations: { nodes: { mediaRecommendation: MediaCard | null }[] };
  characters: {
    edges: {
      role: string;
      node: { name: { full: string }; image: { large: string } };
      voiceActors: { name: { full: string }; image: { large: string } }[];
    }[];
  };
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[];
};

const CARD = `
fragment card on Media {
  id idMal
  title { romaji english userPreferred }
  coverImage { extraLarge large color }
  bannerImage format status episodes averageScore seasonYear season genres
  nextAiringEpisode { episode airingAt }
}`;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 2);
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
      continue;
    }
    const json = await res.json();
    if (json.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`);
    return json.data as T;
  }
  throw new Error("AniList rate limit — try again in a minute");
}

function currentSeason(date = new Date()): { season: string; year: number } {
  const m = date.getMonth();
  const season = m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getFullYear() };
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
  genre?: string;
  year?: number;
  season?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: number;
};

export const SORTS: Record<string, string> = {
  popularity: "POPULARITY_DESC",
  trending: "TRENDING_DESC",
  score: "SCORE_DESC",
  newest: "START_DATE_DESC",
  title: "TITLE_ROMAJI",
};

export async function browse(p: BrowseParams) {
  const sort = p.q ? "SEARCH_MATCH" : SORTS[p.sort ?? "popularity"] ?? "POPULARITY_DESC";
  const vars = {
    search: p.q || null,
    genre: p.genre || null,
    year: p.year || null,
    season: p.season || null,
    format: p.format || null,
    status: p.status || null,
    sort: [sort],
    page: p.page || 1,
  };
  return cached(`browse:${JSON.stringify(vars)}`, 60 * 30, () =>
    gql<{ Page: { pageInfo: { hasNextPage: boolean; currentPage: number }; media: MediaCard[] } }>(
      `query ($search: String, $genre: String, $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort], $page: Int) {
        Page(page: $page, perPage: 30) {
          pageInfo { hasNextPage currentPage }
          media(type: ANIME, isAdult: false, search: $search, genre: $genre, seasonYear: $year, season: $season, format: $format, status: $status, sort: $sort) { ...card }
        }
      }
      ${CARD}`,
      vars,
    ),
  );
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

export async function getMedia(id: number) {
  return cached(`media:${id}`, 60 * 60 * 6, async () => {
    const data = await gql<{ Media: MediaDetail | null }>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          ...card
          description(asHtml: false)
          duration source popularity synonyms
          startDate { year month day }
          studios(isMain: true) { nodes { name } }
          trailer { id site }
          streamingEpisodes { title thumbnail url site }
          externalLinks { url site type icon color }
          tags { name rank isMediaSpoiler }
          relations { edges { relationType node { ...card type } } }
          recommendations(sort: RATING_DESC, perPage: 14) { nodes { mediaRecommendation { ...card } } }
          characters(sort: [ROLE, RELEVANCE], perPage: 12) {
            edges {
              role
              node { name { full } image { large } }
              voiceActors(language: JAPANESE) { name { full } image { large } }
            }
          }
        }
      }
      ${CARD}`,
      { id },
    );
    return data.Media;
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

export const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo", "Mecha",
  "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
];

export function titleOf(m: Pick<MediaCard, "title">) {
  return m.title.english || m.title.userPreferred || m.title.romaji || "Untitled";
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function prettyEnum(s: string | null | undefined) {
  if (!s) return "";
  if (s === "TV_SHORT") return "TV Short";
  if (["TV", "OVA", "ONA"].includes(s)) return s;
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}
