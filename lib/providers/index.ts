import { remoteEmbedProvider } from "./remote-embeds";
import type { Provider, Source, SourceQuery } from "./types";

// Order = priority. Each implements the Provider interface in ./types.
export const providers: Provider[] = [remoteEmbedProvider];

export type ProviderResult = { id: string; name: string; sources: Source[]; error?: string };

export async function resolveSources(q: SourceQuery): Promise<ProviderResult[]> {
  return Promise.all(
    providers
      .filter((p) => p.enabled())
      .map(async (p) => {
        try {
          return { id: p.id, name: p.name, sources: await p.getSources(q) };
        } catch (e) {
          return { id: p.id, name: p.name, sources: [], error: e instanceof Error ? e.message : String(e) };
        }
      }),
  );
}

export function sourceSetup() {
  return { embeds: remoteEmbedProvider.enabled(), library: false };
}

export type { Source, SourceQuery } from "./types";
