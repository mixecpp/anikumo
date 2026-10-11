import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const REASONS = ["spoiler", "harassment", "spam", "offensive", "other"];

/** POST { targetType: "comment" | "review", targetId, reason } */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to report", 401);
  if (!rateLimit(`report:${userId}`, 20, 60 * 60_000).ok) return fail("You've sent a lot of reports. Try again later.", 429);
  const b = await readJson<{ targetType: string; targetId: string; reason: string }>(req);
  const targetType = b.targetType === "review" ? "review" : b.targetType === "comment" ? "comment" : null;
  const reason = REASONS.includes(String(b.reason)) ? String(b.reason) : null;
  const targetId = String(b.targetId ?? "");
  if (!targetType || !reason || !targetId) return fail("Choose a reason");

  const exists =
    targetType === "comment"
      ? await prisma.comment.findUnique({ where: { id: targetId }, select: { userId: true } })
      : await prisma.review.findUnique({ where: { id: targetId }, select: { userId: true } });
  if (!exists) return fail("That content no longer exists", 404);
  if (exists.userId === userId) return fail("You can't report your own post");

  await prisma.report.upsert({
    where: { reporterId_targetType_targetId: { reporterId: userId, targetType, targetId } },
    create: { reporterId: userId, targetType, targetId, reason },
    update: { reason, status: "open" },
  });
  return NextResponse.json({ ok: true });
}
