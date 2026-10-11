import { cached } from "../cache";
import type { Provider } from "./types";

// Channels that publish licensed full episodes for free on YouTube.
const OFFICIAL_CHANNELS = [
  "muse asia",
  "muse india",
  "ani-one asia",
  "crunchyroll",
  "toho animation",
  "gundaminfo",
  "tms anime",
  "retrocrush",
  "viz media",
  "aniplex",
];

type YtItem = {
  id: { videoId?: string };
  snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string } } };
};

function decode(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

function matchesEpisode(title: string, ep: number, single: boolean) {
  if (single) return true;
  const re = new RegExp(`(?:\\bep(?:isode)?\\.?\\s*|#|第)0*${ep}(?![\\d])|\\b0*${ep}\\s*(?:話|화)`, "i");
  return re.test(title);
}

async function search(q: string, key: string) {
  return cached(`yt:${q.toLowerCase()}`, 60 * 60 * 12, async () => {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.search = new URLSearchParams({ part: "snippet", type: "video", maxResults: "25", q, key }).toString();
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 403) throw new Error("YouTube API quota reached or key invalid");
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    return ((await res.json()) as { items: YtItem[] }).items;
  });
}

export const youtubeProvider: Provider = {
  id: "youtube",
  name: "Official YouTube",
  enabled: () => !!process.env.YOUTUBE_API_KEY?.trim(),
  async getSources({ titles, episode, totalEpisodes }) {
    const key = process.env.YOUTUBE_API_KEY!.trim();
    const single = totalEpisodes === 1;
    const title = titles[0];
    const items = await search(single ? `${title} full movie` : `${title} episode ${episode}`, key);

    const titleWords = titles
      .flatMap((t) => t.toLowerCase().split(/[^a-z0-9]+/))
      .filter((w) => w.length > 3);

    return items
      .filter((it) => it.id.videoId)
      .filter((it) => OFFICIAL_CHANNELS.some((c) => it.snippet.channelTitle.toLowerCase().includes(c)))
      .filter((it) => {
        const t = decode(it.snippet.title);
        const lower = t.toLowerCase();
        const mentionsShow = titleWords.length === 0 || titleWords.some((w) => lower.includes(w));
        return mentionsShow && matchesEpisode(t, episode, single);
      })
      .slice(0, 3)
      .map((it) => ({
        provider: "youtube",
        label: it.snippet.channelTitle,
        kind: "youtube" as const,
        videoId: it.id.videoId,
        url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
        thumbnail: it.snippet.thumbnails.medium?.url,
        note: decode(it.snippet.title),
        badge: "Official · Free",
      }));
  },
};
