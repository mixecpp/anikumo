import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId, tooFast } from "@/lib/http";

const METRICS = ["episodes", "shows", "hours"] as const;
const PERIODS = ["week", "month"] as const;

/** POST { metric, period, target } creates or updates a goal; target 0 removes it. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);

  const slow = tooFast(`goals:${userId}`, 30);

  if (slow) return slow;
  const b = await readJson<{ metric: string; period: string; target: number }>(req);
  const metric = METRICS.find((m) => m === b.metric);
  const period = PERIODS.find((p) => p === b.period);
  const target = Math.floor(Number(b.target));
  if (!metric || !period) return fail("Choose what to track and how often");
  if (!Number.isFinite(target) || target < 0 || target > 1000) return fail("Target must be 0–1000");

  const key = { userId_metric_period: { userId, metric, period } };
  if (target === 0) {
    await prisma.watchGoal.deleteMany({ where: { userId, metric, period } });
    return NextResponse.json({ ok: true, removed: true });
  }
  const goal = await prisma.watchGoal.upsert({ where: key, create: { userId, metric, period, target }, update: { target } });
  return NextResponse.json({ goal });
}
