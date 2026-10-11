import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { syncEpisodeAlerts } from "@/lib/notifications";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ notifications: [], unread: 0 });
  if (new URL(req.url).searchParams.get("sync") === "1") await syncEpisodeAlerts(userId).catch(() => {});
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return NextResponse.json({ notifications, unread }, { headers: { "Cache-Control": "private, no-store" } });
}

/** POST { ids?: string[] } marks the given notifications (or all) as read. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const { ids } = await readJson<{ ids: string[] }>(req);
  const where = Array.isArray(ids) && ids.length ? { userId, id: { in: ids.map(String).slice(0, 200) }, readAt: null } : { userId, readAt: null };
  const { count } = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true, count });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  await prisma.notification.deleteMany({ where: { userId, readAt: { not: null } } });
  return NextResponse.json({ ok: true });
}
