import type { Provider, Source } from "./types";

function episodeFromTitle(title: string): number | null {
  const m = title.match(/(?:episode|ep\.?)\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

export const officialProvider: Provider = {
  id: "official",
  name: "Official Streaming",
  enabled: () => true,
  async getSources({ episode, streamingEpisodes, externalLinks }) {
    const out: Source[] = [];

    for (const se of streamingEpisodes) {
      if (episodeFromTitle(se.title) === episode) {
        out.push({
          provider: "official",
          label: se.site,
          kind: "external",
          url: se.url,
          thumbnail: se.thumbnail,
          note: se.title,
          badge: "This episode",
        });
      }
    }

    const seen = new Set(out.map((s) => s.label));
    for (const link of externalLinks) {
      if (link.type !== "STREAMING") continue;
      const label = link.site;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ provider: "official", label, kind: "external", url: link.url, badge: "Series page" });
    }
    return out;
  },
};
