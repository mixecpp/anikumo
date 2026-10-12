import { warm } from "./cache";
import { installCacheStore, pruneCache } from "./cache-store";
import { browse, currentSeason, getHomeData, getMedia, getSchedule, getSeason, getTagCollection, getTopChart, shiftSeason } from "./anilist";
import { parseBrowseParams } from "./browse-params";

/**
 * Keeps the AniList data behind the busiest pages fresh, so visitors never wait on AniList:
 * every 10 minutes it refetches home, today's and this week's schedule, the seasonal charts,
 * top charts, the default browse page, tags and the shows trending right now (their detail
 * pages). Requests go one at a time with a short gap — well inside AniList's rate limit.
 * Started once per server from instrumentation.ts.
 */
const EVERY = 10 * 60_000;
const GAP = 700;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The same windows the home and schedule pages ask for (so they hit the same cache keys). */
function scheduleWindows() {
  const now = Math.floor(Date.now() / 1000 / 900) * 900;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  const from = Math.floor(start.getTime() / 1000);
  return [
    [now - 2 * 3600, now + 24 * 3600],
    [from, from + 8 * 86400],
  ] as const;
}

async function warmOnce() {
  const started = Date.now();
  const { season, year } = currentSeason();
  const next = shiftSeason(season, year, 1);
  const prev = shiftSeason(season, year, -1);
  const browseDefault = { ...parseBrowseParams({}), page: 1 };

  const jobs: [string, () => Promise<unknown>][] = [
    ["home", () => getHomeData()],
    ...scheduleWindows().map(([from, to]) => [`schedule ${from}`, () => getSchedule(from, to)] as [string, () => Promise<unknown>]),
    ["season", () => getSeason(season, year)],
    ["next season", () => getSeason(next.season, next.year)],
    ["last season", () => getSeason(prev.season, prev.year)],
    ["top chart", () => getTopChart({})],
    ["browse", () => browse(browseDefault)],
    ["browse (no ecchi)", () => browse({ ...browseDefault, excludeGenres: ["Ecchi"] })],
    ["tags", () => getTagCollection()],
  ];

  let ok = 0;
  for (const [, job] of jobs) {
    try {
      await warm(job);
      ok++;
    } catch {
      // AniList hiccup: the old copy keeps being served; try again next round.
    }
    await sleep(GAP);
  }

  // Detail pages for what's trending right now.
  try {
    const home = await getHomeData();
    const ids = [...new Set([...home.trending.media, ...home.seasonal.media].map((m) => m.id))].slice(0, 16);
    for (const id of ids) {
      try {
        await warm(() => getMedia(id));
        ok++;
      } catch {}
      await sleep(GAP);
    }
  } catch {}

  await pruneCache();
  if (process.env.NODE_ENV !== "production") console.log(`[warm] refreshed ${ok} AniList queries in ${Math.round((Date.now() - started) / 1000)}s`);
}

export function startWarmer() {
  const g = globalThis as unknown as { __akWarmer?: boolean };
  if (g.__akWarmer || process.env.ANILIST_WARMER === "off") return;
  g.__akWarmer = true;
  installCacheStore();
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await warmOnce();
    } finally {
      running = false;
    }
  };
  // Give the server a moment to start, then keep going every 10 minutes.
  setTimeout(tick, 15_000);
  setInterval(tick, EVERY);
}
