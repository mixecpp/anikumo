export type SourceKind = "video" | "youtube" | "iframe" | "external";

export type Source = {
  provider: string;
  label: string;
  kind: SourceKind;
  url: string;
  /** YouTube video id, so the player can use the IFrame API for resume/progress. */
  videoId?: string;
  subtitles?: { label: string; lang: string; url: string }[];
  thumbnail?: string;
  note?: string;
  badge?: string;
  fallbackUrl?: string;
  controls?: boolean;
};

export type SourceQuery = {
  anilistId: number;
  episode: number;
  audioTrack?: "sub" | "dub";
  titles: string[];
  totalEpisodes: number | null;
  startYear: number | null;
  streamingEpisodes: { title: string; thumbnail: string; url: string; site: string }[];
  externalLinks: { url: string; site: string; type: string }[];
};

export interface Provider {
  id: string;
  name: string;
  enabled(): boolean;
  getSources(q: SourceQuery): Promise<Source[]>;
}
