import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { logAdmin } from "@/lib/admin";
import { checkText } from "@/lib/automod";
import { ANNOUNCEMENT_MAX, DURATIONS, announcementHistory, cleanHref, forgetAnnouncement } from "@/lib/chat";

/** GET: recent announcements (admins). */
export async function GET() {
  if (!(await requireAdmin())) return fail("Not found", 404);
  return NextResponse.json({ announcements: await announcementHistory() });
}

/** POST { action: "create", body, href?, tone?, duration } | { action: "end", id } (admins). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail("Not found", 404);
  const b = await readJson<Record<string, unknown>>(req);

  if (b.action === "create") {
    const body = String(b.body ?? "").trim().replace(/\s+/g, " ");
    if (!body || body.length > ANNOUNCEMENT_MAX) return fail(`Announcements are 1–${ANNOUNCEMENT_MAX} characters`);
    const blocked = checkText(body);
    if (blocked) return fail(blocked);
    const href = cleanHref(b.href);
    if (href === null) return fail("Links must be a page on the site (starting with /) or an https link");
    const duration = DURATIONS[String(b.duration) as keyof typeof DURATIONS];
    if (!duration) return fail("Pick how long it runs");
    const tone = b.tone === "important" ? "important" : "info";
    // One at a time: a new announcement replaces the one that is running.
    await prisma.announcement.updateMany({ where: { endedAt: null, expiresAt: { gt: new Date() } }, data: { endedAt: new Date() } });
    const a = await prisma.announcement.create({ data: { authorId: admin.id, body, href, tone, expiresAt: new Date(Date.now() + duration) } });
    forgetAnnouncement();
    await logAdmin(admin.id, "Posted an announcement", "", body);
    return NextResponse.json({ ok: true, id: a.id });
  }

  if (b.action === "end") {
    await prisma.announcement.updateMany({ where: { id: String(b.id ?? ""), endedAt: null }, data: { endedAt: new Date() } });
    forgetAnnouncement();
    await logAdmin(admin.id, "Ended an announcement");
    return NextResponse.json({ ok: true });
  }
  return fail("Unknown action");
}
