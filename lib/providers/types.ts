export type SourceKind = "video" | "youtube" | "external";

export type Source = {
  provider: string;
  label: string;
  kind: SourceKind;
  url: string;
  subtitles?: { label: string; lang: string; url: string }[];
  thumbnail?: string;
  note?: string;
};

export type SourceQuery = {
  anilistId: number;
  episode: number;
  titles: string[];
  totalEpisodes: number | null;
  streamingEpisodes: { title: string; thumbnail: string; url: string; site: string }[];
  externalLinks: { url: string; site: string; type: string }[];
};

export interface Provider {
  id: string;
  name: string;
  enabled(): boolean;
  getSources(q: SourceQuery): Promise<Source[]>;
}
