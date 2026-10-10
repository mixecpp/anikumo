import { localProvider } from "./local";
import { youtubeProvider } from "./youtube";
import { officialProvider } from "./official";
import type { Provider, Source, SourceQuery } from "./types";

// Order = priority. Add new providers here; each implements the Provider interface in ./types.
export const providers: Provider[] = [localProvider, youtubeProvider, officialProvider];

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

export type { Source, SourceQuery } from "./types";
