import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fail } from "@/lib/http";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
const PAGE = 25;

/** GET ?q=&filter=all|admins|banned&page= → paginated users with activity counts. */
export async function GET(req: Request) {
  if (!(await requireAdmin())) return fail("Admins only", 403);
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 40);
  const filter = sp.get("filter");
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const where = {
    ...(q ? { username: { contains: q } } : {}),
    ...(filter === "admins" ? { isAdmin: true } : filter === "banned" ? { bannedAt: { not: null } } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * PAGE,
      take: PAGE,
      select: {
        id: true,
        username: true,
        avatarColor: true,
        createdAt: true,
        isAdmin: true,
        bannedAt: true,
        banReason: true,
        totpEnabled: true,
        profilePublic: true,
        sessions: { where: { revokedAt: null }, orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
        _count: { select: { listEntries: true, comments: true, reviews: true } },
      },
    }),
  ]);
  return NextResponse.json({
    total,
    pageSize: PAGE,
    users: users.map(({ sessions, _count, ...u }) => ({ ...u, lastSeenAt: sessions[0]?.lastSeenAt ?? null, counts: _count })),
  });
}
