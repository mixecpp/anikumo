import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { quickSearch, titleOf } from "./anilist";

export const VIDEO_EXTS = new Set([".mp4", ".mkv", ".webm", ".m4v", ".mov"]);
const SUB_EXTS = [".vtt", ".srt"];

export function libraryRoot(): string | null {
  const dir = process.env.LIBRARY_DIR?.trim();
  return dir ? path.resolve(dir) : null;
}

/** Resolve a DB-stored relative path, refusing anything that escapes the library folder. */
export function safeLibraryPath(relative: string): string {
  const root = libraryRoot();
  if (!root) throw new Error("LIBRARY_DIR not configured");
  const full = path.resolve(root, relative);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Path outside library");
  return full;
}

export function parseEpisodeNumber(fileName: string): number | null {
  const base = fileName.replace(/\.[^.]+$/, "");
  const patterns = [
    /S\d{1,2}[\s._-]*E(\d{1,4})/i,
    /\b(?:episode|ep)[\s._-]*(\d{1,4})\b/i,
    /\bE(\d{1,4})\b/,
    / - (\d{1,4})(?:v\d)?(?=[\s.[(]|$)/,
    /第(\d{1,4})[話话集]/,
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (m) return Number(m[1]);
  }
  const cleaned = base
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\b\d{3,4}p\b|\b[xh]\.?26[45]\b|\b(?:19|20)\d{2}\b|\b10.?bit\b/gi, " ");
  const nums = cleaned.match(/(?<![\d.])\d{1,4}(?![\d.])/g);
  return nums ? Number(nums[nums.length - 1]) : null;
}

function cleanFolderTitle(name: string) {
  return name
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, " ")
    .replace(/\b(?:1080p|720p|480p|2160p|bd|bluray|web-?dl|dual audio|batch|complete)\b/gi, " ")
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function walkVideos(dir: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkVideos(full, depth + 1)));
    else if (VIDEO_EXTS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

async function findSubtitle(videoPath: string): Promise<string | null> {
  const stem = videoPath.slice(0, -path.extname(videoPath).length);
  const candidates = SUB_EXTS.flatMap((ext) => [`${stem}${ext}`, `${stem}.en${ext}`, `${stem}.eng${ext}`]);
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {}
  }
  return null;
}

export type ScanReport = { series: number; episodes: number; unmatched: string[]; error?: string };

export async function scanLibrary(): Promise<ScanReport> {
  const root = libraryRoot();
  if (!root) return { series: 0, episodes: 0, unmatched: [], error: "LIBRARY_DIR is not set in .env" };
  try {
    await fs.access(root);
  } catch {
    return { series: 0, episodes: 0, unmatched: [], error: `Folder not found: ${root}` };
  }

  const dirs = (await fs.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory());
  const report: ScanReport = { series: 0, episodes: 0, unmatched: [] };
  const seen = new Set<string>();

  for (const d of dirs) {
    seen.add(d.name);
    const folder = path.join(root, d.name);
    const videos = await walkVideos(folder);
    if (!videos.length) continue;

    const existing = await prisma.librarySeries.findUnique({ where: { folderName: d.name } });
    let anilistId = existing?.anilistId ?? null;
    let title = existing?.title ?? null;
    let coverImage = existing?.coverImage ?? null;

    const idInName = d.name.match(/\[(\d{1,7})\]/);
    if (idInName) anilistId = Number(idInName[1]);

    if (!anilistId || !title) {
      try {
        const query = cleanFolderTitle(d.name);
        const results = await quickSearch(query);
        const hit = idInName ? results.find((r) => r.id === anilistId) ?? null : results[0] ?? null;
        if (hit) {
          anilistId = anilistId ?? hit.id;
          title = titleOf(hit);
          coverImage = hit.coverImage.large;
        }
      } catch {}
    }
    if (!anilistId) report.unmatched.push(d.name);

    const series = await prisma.librarySeries.upsert({
      where: { folderName: d.name },
      create: { folderName: d.name, anilistId, title: title ?? d.name, coverImage },
      update: { anilistId, title: title ?? d.name, coverImage, scannedAt: new Date() },
    });

    const byEpisode = new Map<number, string>();
    const sorted = videos.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    sorted.forEach((v, i) => {
      const n = parseEpisodeNumber(path.basename(v)) ?? (sorted.length === 1 ? 1 : i + 1);
      if (!byEpisode.has(n)) byEpisode.set(n, v);
    });

    await prisma.libraryEpisode.deleteMany({ where: { seriesId: series.id } });
    for (const [episode, file] of byEpisode) {
      const stat = await fs.stat(file);
      const sub = await findSubtitle(file);
      await prisma.libraryEpisode.create({
        data: {
          seriesId: series.id,
          episode,
          relativePath: path.relative(root, file),
          subtitlePath: sub ? path.relative(root, sub) : null,
          sizeBytes: Math.min(stat.size, 2_147_483_647),
        },
      });
      report.episodes++;
    }
    report.series++;
  }

  await prisma.librarySeries.deleteMany({ where: { folderName: { notIn: [...seen] } } });
  return report;
}

export function srtToVtt(srt: string) {
  return (
    "WEBVTT\n\n" +
    srt
      .replace(/\r/g, "")
      .replace(/^\d+\n(?=\d{2}:\d{2})/gm, "")
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  );
}

export function mimeFor(file: string) {
  switch (path.extname(file).toLowerCase()) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
    case ".mkv":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}
