import { getHomeData } from "./anilist";

export async function authCovers() {
  return getHomeData()
    .then((d) => [...d.trending.media, ...d.popular.media].map((m) => m.coverImage.large).slice(0, 18))
    .catch(() => [] as string[]);
}
