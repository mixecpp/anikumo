import { prisma } from "../db";
import { libraryRoot } from "../library";
import type { Provider } from "./types";

export const localProvider: Provider = {
  id: "local",
  name: "My Library",
  enabled: () => !!libraryRoot(),
  async getSources({ anilistId, episode }) {
    const eps = await prisma.libraryEpisode.findMany({
      where: { episode, series: { anilistId } },
      include: { series: true },
    });
    return eps.map((e) => ({
      provider: "local",
      label: `My Library · ${e.series.folderName}`,
      kind: "video" as const,
      url: `/api/library/stream/${e.id}`,
      subtitles: e.subtitlePath ? [{ label: "Subtitles", lang: "en", url: `/api/library/subs/${e.id}` }] : [],
    }));
  },
};
