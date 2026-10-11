import type { Provider, Source } from "./types";

export type AudioTrack = "sub" | "dub";

export function aniweebEmbedUrl(id: number, episode: number, track: AudioTrack = "sub", idType: "ani" | "mal" = "ani") {
  return `https://api.aniweeb.net/embed/${idType}/${id}/${episode}?track=${track === "dub" ? "dub" : "sub"}`;
}

// Aniweeb owns stream resolution, server selection and in-player audio controls.
// https://api.aniweeb.net/docs
export function remoteEmbedSources(anilistId: number, episode: number, track: AudioTrack = "sub"): Source[] {
  if (!Number.isSafeInteger(anilistId) || anilistId < 1 || !Number.isSafeInteger(episode) || episode < 1) return [];
  return [
    {
      provider: "aniweeb",
      label: "Aniweeb",
      kind: "iframe",
      url: aniweebEmbedUrl(anilistId, episode, track),
      note: "Episode availability depends on the provider",
    },
  ];
}

export const remoteEmbedProvider: Provider = {
  id: "aniweeb",
  name: "Aniweeb",
  enabled: () => process.env.REMOTE_EMBEDS_ENABLED !== "false",
  async getSources({ anilistId, episode, totalEpisodes, audioTrack }) {
    if (totalEpisodes !== null && totalEpisodes > 0 && episode > totalEpisodes) return [];
    return remoteEmbedSources(anilistId, episode, audioTrack);
  },
};
