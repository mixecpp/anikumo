import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { getEntryDTO, getList, toDTO, upsertEntry, validatePatch, watchedUpTo } from "@/lib/list";
import { isStatus } from "@/lib/list-shared";

/** GET → whole list, or ?anilistId= for one entry. */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ entries: [], entry: null });
  const id = toInt(new URL(req.url).searchParams.get("anilistId"));
  if (id) return NextResponse.json({ entry: await getEntryDTO(userId, id) });
  return NextResponse.json({ entries: await getList(userId) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** POST { anilistId, ...patch } → create/update one entry. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to use your list", 401);
  const body = await readJson<Record<string, unknown>>(req);
  const anilistId = toInt(body.anilistId);
  if (!anilistId || anilistId < 1) return fail("anilistId required");
  const patch = validatePatch(body);
  if (typeof patch === "string") return fail(patch);
  const row = await upsertEntry(userId, anilistId, patch);
  const upTo = await watchedUpTo(userId, [anilistId]);
  return NextResponse.json({ entry: toDTO(row, upTo.get(anilistId) ?? 0) });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const anilistId = toInt(new URL(req.url).searchParams.get("anilistId"));
  if (!anilistId) return fail("anilistId required");
  await prisma.listEntry.deleteMany({ where: { userId, anilistId } });
  return NextResponse.json({ ok: true });
}

/** PATCH { ids: number[], status?, addTag?, removeTag?, remove? } → bulk edit. */
export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const body = await readJson<{ ids: unknown[]; status: string; addTag: string; removeTag: string; remove: boolean }>(req);
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(toInt).filter((n): n is number => !!n && n > 0).slice(0, 500);
  if (!ids.length) return fail("Select at least one show");

  if (body.remove === true) {
    const { count } = await prisma.listEntry.deleteMany({ where: { userId, anilistId: { in: ids } } });
    return NextResponse.json({ ok: true, count });
  }
  if (body.status !== undefined) {
    if (!isStatus(body.status)) return fail("Invalid status");
    for (const id of ids) await upsertEntry(userId, id, { status: body.status });
  }
  const tag = (body.addTag ?? body.removeTag ?? "").toString().trim().toLowerCase().slice(0, 24);
  if (tag) {
    const rows = await prisma.listEntry.findMany({ where: { userId, anilistId: { in: ids } } });
    for (const r of rows) {
      let tags: string[] = [];
      try {
        tags = JSON.parse(r.tags);
      } catch {}
      const next = body.addTag ? [...new Set([...tags, tag])].slice(0, 12) : tags.filter((t) => t !== tag);
      await prisma.listEntry.update({ where: { id: r.id }, data: { tags: JSON.stringify(next) } });
    }
  }
  return NextResponse.json({ ok: true, count: ids.length });
}
