import { cached } from "./cache";
import { gql } from "./anilist";

type Row = { id: number; updatedAt?: number | null };

const PER_PAGE = 50;
const pause = () => new Promise((r) => setTimeout(r, 350));

/** Popular AniList ids for the sitemap, fetched politely (sequential, paced) and cached for a day. */
async function pages(kind: "anime" | "characters" | "staff" | "studios", from: number, count: number): Promise<Row[]> {
  return cached(`sitemap:v2:${kind}:${from}:${count}`, 60 * 60 * 24, async () => {
    const field = {
      anime: "media(type: ANIME, isAdult: false, sort: POPULARITY_DESC) { id updatedAt }",
      characters: "characters(sort: FAVOURITES_DESC) { id }",
      staff: "staff(sort: FAVOURITES_DESC) { id }",
      studios: "studios(sort: FAVOURITES_DESC) { id }",
    }[kind];
    const out: Row[] = [];
    for (let page = from; page < from + count; page++) {
      // AniList only pages past 1 when pageInfo is requested too.
      const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean } } & Record<string, Row[]> }>(
        `query ($page: Int) { Page(page: $page, perPage: ${PER_PAGE}) { pageInfo { hasNextPage } ${field} } }`,
        { page },
      );
      const { pageInfo, ...rest } = data.Page;
      const rows = (Object.values(rest)[0] as Row[] | undefined) ?? [];
      out.push(...rows);
      if (!pageInfo.hasNextPage || !rows.length) break;
      await pause();
    }
    return out;
  });
}

/** 2,000 most popular anime, in four chunks of 500. */
export const animeChunk = (chunk: number) => pages("anime", chunk * 10 + 1, 10);
export const topCharacters = () => pages("characters", 1, 10);
export const topStaff = () => pages("staff", 1, 5);
export const topStudios = () => pages("studios", 1, 2);
