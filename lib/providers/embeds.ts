import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Provider, Source } from "./types";

type EmbedEntry = {
  anilistId: number;
  label: string;
  note?: string;
} & (
  | { episode: number; url: string }
  | { firstEpisode: number; lastEpisode: number; urlTemplate: string }
);

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function expand(template: string, anilistId: number, episode: number) {
  return template.replaceAll("{anilistId}", String(anilistId)).replaceAll("{episode}", String(episode));
}

function embedUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || /[{}]/.test(value)) {
    throw new Error("Expected an HTTPS embed URL without credentials or unknown placeholders");
  }
  return url.href;
}

/** Validate the whole catalog before using it; never evaluate pasted HTML or scripts. */
export function parseEmbedCatalog(value: unknown): EmbedEntry[] {
  if (!Array.isArray(value)) throw new Error("Embed catalog must be a JSON array");
  return value.map((entry: unknown, index) => {
    try {
      if (!entry || typeof entry !== "object") throw new Error("Expected an object");
      const e = entry as Record<string, unknown>;
      if (!positiveInt(e.anilistId)) throw new Error("anilistId must be a positive integer");
      if (typeof e.label !== "string" || !e.label.trim()) throw new Error("label is required");
      if (e.note !== undefined && typeof e.note !== "string") throw new Error("note must be text");
      const base = { anilistId: e.anilistId, label: e.label.trim(), note: e.note as string | undefined };
      if ("episode" in e || "url" in e) {
        if ("urlTemplate" in e || "firstEpisode" in e || "lastEpisode" in e) {
          throw new Error("Use either an episode URL or a template range");
        }
        if (!positiveInt(e.episode) || typeof e.url !== "string") {
          throw new Error("episode and url are required");
        }
        return { ...base, episode: e.episode, url: embedUrl(e.url) };
      }
      if (!positiveInt(e.firstEpisode) || !positiveInt(e.lastEpisode) || e.lastEpisode < e.firstEpisode) {
        throw new Error("firstEpisode and lastEpisode must describe a valid range");
      }
      if (typeof e.urlTemplate !== "string" || !e.urlTemplate.includes("{episode}")) {
        throw new Error("urlTemplate must contain {episode}");
      }
      // Placeholders belong in the path/query, never in the provider's origin.
      const first = new URL(embedUrl(expand(e.urlTemplate, e.anilistId, e.firstEpisode)));
      const probe = new URL(embedUrl(expand(e.urlTemplate, e.anilistId + 1, e.firstEpisode + 1)));
      if (first.origin !== probe.origin) throw new Error("Template origin must be fixed");
      return { ...base, firstEpisode: e.firstEpisode, lastEpisode: e.lastEpisode, urlTemplate: e.urlTemplate };
    } catch (error) {
      // URL parser errors can include the supplied URL; keep diagnostics free of tokens.
      const detail = error instanceof TypeError ? "Invalid embed URL" : (error as Error).message;
      throw new Error(`Embed catalog entry ${index + 1}: ${detail}`);
    }
  });
}

export function sourcesFromCatalog(catalog: EmbedEntry[], anilistId: number, episode: number): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const entry of catalog) {
    if (entry.anilistId !== anilistId) continue;
    let url: string;
    if ("episode" in entry) {
      if (entry.episode !== episode) continue;
      url = entry.url;
    } else {
      if (episode < entry.firstEpisode || episode > entry.lastEpisode) continue;
      url = embedUrl(expand(entry.urlTemplate, anilistId, episode));
    }
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ provider: "embeds", label: entry.label, kind: "iframe", url, note: entry.note });
  }
  return sources;
}

export const embedProvider: Provider = {
  id: "embeds",
  name: "Episode embeds",
  enabled: () => true,
  async getSources({ anilistId, episode }) {
    const configuredPath = process.env.EPISODE_EMBEDS_FILE?.trim();
    const filename = path.resolve(configuredPath || "data/embeds.json");
    let contents: string;
    try {
      contents = await readFile(filename, "utf8");
    } catch (error) {
      if (!configuredPath && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new Error("Cannot read the episode embed catalog");
    }
    let data: unknown;
    try {
      data = JSON.parse(contents.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("Episode embed catalog contains invalid JSON");
    }
    return sourcesFromCatalog(parseEmbedCatalog(data), anilistId, episode);
  },
};
