import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, revokeSession, revokeSessions } from "@/lib/auth";
import { fail } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Not logged in", 401);
  const rows = await prisma.session.findMany({
    where: { userId: session.userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true },
  });
  return NextResponse.json({ sessions: rows.map((r) => ({ ...r, current: r.id === session.sid })) });
}

/** ?id=<sid> revokes one session; ?others=1 revokes every session except this one. */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return fail("Not logged in", 401);
  const sp = new URL(req.url).searchParams;
  if (sp.get("others") === "1") {
    const count = await revokeSessions(session.userId, session.sid);
    return NextResponse.json({ ok: true, count });
  }
  const id = sp.get("id");
  if (!id) return fail("id or others=1 required");
  if (id === session.sid) return fail("Use log out to end this session");
  await revokeSession(id, session.userId);
  return NextResponse.json({ ok: true });
}
