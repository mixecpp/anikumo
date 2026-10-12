import { NextResponse } from "next/server";
import { checkText } from "@/lib/automod";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { getSnapshots } from "@/lib/media";

/** GET → your custom lists (with whether ?anilistId= is already in each). */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ lists: [] });
  const anilistId = toInt(new URL(req.url).searchParams.get("anilistId"));
  const lists = await prisma.customList.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } }, items: { where: { anilistId: anilistId ?? -1 }, select: { id: true } } },
  });
  return NextResponse.json({
    lists: lists.map(({ items, _count, ...l }) => ({ ...l, count: _count.items, contains: items.length > 0 })),
  });
}

/**
 * POST { action: "create", title, description, isPublic }
 * POST { action: "update", listId, title?, description?, isPublic? }
 * POST { action: "delete", listId }
 * POST { action: "toggle", listId, anilistId }      add/remove a show
 * POST { action: "note", listId, anilistId, note }
 * POST { action: "reorder", listId, order: number[] }  anilistIds in order
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to make lists", 401);
  const b = await readJson<Record<string, unknown>>(req);
  const action = b.action;

  if (action === "create") {
    const title = String(b.title ?? "").trim().slice(0, 80);
    if (!title) return fail("Give the list a name");
    const description = String(b.description ?? "").slice(0, 500);
    const blocked = checkText(title, description);
    if (blocked) return fail(blocked);
    if ((await prisma.customList.count({ where: { userId } })) >= 50) return fail("You can have up to 50 lists");
    const list = await prisma.customList.create({ data: { userId, title, description, isPublic: b.isPublic === true } });
    return NextResponse.json({ list });
  }

  const list = await prisma.customList.findFirst({ where: { id: String(b.listId ?? ""), userId } });
  if (!list) return fail("List not found", 404);

  if (action === "update") {
    const data: Record<string, unknown> = {};
    if (b.title !== undefined) {
      const title = String(b.title).trim().slice(0, 80);
      if (!title) return fail("Give the list a name");
      data.title = title;
    }
    if (b.description !== undefined) data.description = String(b.description).slice(0, 500);
    const blocked = checkText(data.title as string | undefined, data.description as string | undefined);
    if (blocked) return fail(blocked);
    if (b.isPublic !== undefined) data.isPublic = b.isPublic === true;
    return NextResponse.json({ list: await prisma.customList.update({ where: { id: list.id }, data }) });
  }
  if (action === "delete") {
    await prisma.customList.delete({ where: { id: list.id } });
    return NextResponse.json({ ok: true });
  }

  const anilistId = toInt(b.anilistId);
  if (action === "toggle") {
    if (!anilistId) return fail("anilistId required");
    const key = { listId_anilistId: { listId: list.id, anilistId } };
    const existing = await prisma.customListItem.findUnique({ where: key });
    if (existing) {
      await prisma.customListItem.delete({ where: key });
      await prisma.customList.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
      return NextResponse.json({ contains: false });
    }
    if ((await prisma.customListItem.count({ where: { listId: list.id } })) >= 500) return fail("Lists can hold up to 500 shows");
    const snap = (await getSnapshots([anilistId])).get(anilistId);
    // AniList's title and cover win; what the browser sent is only a fallback (and filtered).
    const title = String(snap?.title ?? b.title ?? "Untitled").slice(0, 300);
    if (checkText(title)) return fail("Couldn't find that anime");
    const cover = String(snap?.coverImage ?? b.coverImage ?? "");
    const max = await prisma.customListItem.aggregate({ where: { listId: list.id }, _max: { position: true } });
    await prisma.customListItem.create({
      data: { listId: list.id, anilistId, title, coverImage: /^https:\/\/s\d+\.anilist\.co\//.test(cover) ? cover.slice(0, 500) : "", position: (max._max.position ?? 0) + 1 },
    });
    await prisma.customList.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ contains: true });
  }
  if (action === "note") {
    if (!anilistId) return fail("anilistId required");
    const note = String(b.note ?? "").slice(0, 300);
    const blocked = checkText(note);
    if (blocked) return fail(blocked);
    await prisma.customListItem.updateMany({ where: { listId: list.id, anilistId }, data: { note } });
    return NextResponse.json({ ok: true });
  }
  if (action === "reorder") {
    const order = (Array.isArray(b.order) ? b.order : []).map(toInt).filter((n): n is number => !!n);
    await prisma.$transaction(order.map((id, i) => prisma.customListItem.updateMany({ where: { listId: list.id, anilistId: id }, data: { position: i } })));
    return NextResponse.json({ ok: true });
  }
  return fail("Unknown action");
}
