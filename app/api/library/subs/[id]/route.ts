import fs from "node:fs/promises";
import { prisma } from "@/lib/db";
import { safeLibraryPath, srtToVtt } from "@/lib/library";
import { fail, requireUserId } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUserId())) return fail("Not logged in", 401);
  const { id } = await params;
  const ep = await prisma.libraryEpisode.findUnique({ where: { id } });
  if (!ep?.subtitlePath) return fail("No subtitles", 404);

  try {
    const raw = await fs.readFile(safeLibraryPath(ep.subtitlePath), "utf8");
    const vtt = ep.subtitlePath.toLowerCase().endsWith(".srt") ? srtToVtt(raw) : raw;
    return new Response(vtt, { headers: { "Content-Type": "text/vtt; charset=utf-8" } });
  } catch {
    return fail("Subtitle file missing", 404);
  }
}
