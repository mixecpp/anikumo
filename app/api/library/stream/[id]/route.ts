import fs from "node:fs";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { mimeFor, safeLibraryPath } from "@/lib/library";
import { fail, requireUserId } from "@/lib/http";

const CHUNK = 4 * 1024 * 1024;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUserId())) return fail("Log in to stream your library", 401);
  const { id } = await params;
  const ep = await prisma.libraryEpisode.findUnique({ where: { id } });
  if (!ep) return fail("Not found", 404);

  let file: string;
  let size: number;
  try {
    file = safeLibraryPath(ep.relativePath);
    size = (await fs.promises.stat(file)).size;
  } catch {
    return fail("File missing — rescan your library", 404);
  }

  const type = mimeFor(file);
  const range = req.headers.get("range");
  if (!range) {
    const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
    return new Response(stream, {
      headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" },
    });
  }

  const m = range.match(/bytes=(\d*)-(\d*)/);
  if (!m) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  let start = m[1] ? Number(m[1]) : size - Number(m[2]);
  let end = m[1] && m[2] ? Number(m[2]) : Math.min(start + CHUNK - 1, size - 1);
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });

  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}
