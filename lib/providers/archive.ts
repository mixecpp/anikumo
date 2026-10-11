import { cached } from "../cache";
import type { Provider, Source } from "./types";

// Only works old enough to be public domain in the US (published 95+ years ago, rolling each Jan 1).
// Uploader-supplied license fields aren't trusted for anything newer.
function publicDomainCutoff() {
  return new Date().getFullYear() - 96;
}

type Doc = { identifier: string; title: string; year?: string };
type ArchiveFile = { name: string; format?: string; length?: string };

const VIDEO = /\.(mp4|ogv|webm|m4v)$/i;

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function episodeOf(name: string): number | null {
  const m = name.match(/(?:ep(?:isode)?|e|第)[\s._-]*0*(\d{1,3})/i) ?? name.match(/(?:^|[\s._-])0*(\d{1,3})(?=[\s._-]|\.\w+$)/);
  return m ? Number(m[1]) : null;
}

export const archiveProvider: Provider = {
  id: "archive",
  name: "Internet Archive",
  enabled: () => true,
  async getSources({ titles, episode, startYear }) {
    if (!startYear || startYear > publicDomainCutoff()) return [];

    const wanted = titles.map(normalize).filter((t) => t.length > 2);
    const docs = await cached(`ia:search:${wanted[0]}`, 60 * 60 * 24, async () => {
      const q = `(${titles.map((t) => `title:("${t.replace(/"/g, "")}")`).join(" OR ")}) AND mediatype:movies`;
      const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=year&rows=15&output=json`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Archive search ${res.status}`);
      return ((await res.json()) as { response: { docs: Doc[] } }).response.docs;
    });

    const matches = docs.filter((d) => {
      const t = normalize(d.title);
      const yearOk = !d.year || Number(d.year) <= publicDomainCutoff();
      return yearOk && wanted.some((w) => t.includes(w));
    });

    const out: Source[] = [];
    for (const d of matches.slice(0, 4)) {
      const files = await cached(`ia:meta:${d.identifier}`, 60 * 60 * 24, async () => {
        const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}/files`, { cache: "no-store" });
        if (!res.ok) return [] as ArchiveFile[];
        return ((await res.json()) as { result: ArchiveFile[] }).result ?? [];
      });
      const videos = files.filter((f) => VIDEO.test(f.name));
      if (!videos.length) continue;
      const pick = videos.length === 1 ? (episode === 1 ? videos[0] : null) : videos.find((f) => episodeOf(f.name) === episode);
      if (!pick) continue;
      out.push({
        provider: "archive",
        label: "Internet Archive",
        kind: "iframe",
        url: `https://archive.org/embed/${encodeURIComponent(d.identifier)}/${encodeURIComponent(pick.name)}`,
        note: d.title,
        badge: "Public domain",
      });
      if (out.length >= 2) break;
    }
    return out;
  },
};
