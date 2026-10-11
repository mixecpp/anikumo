import { prisma } from "./db";
import { totalSeconds, watchedEpisodes } from "./watchtime";

export type GoalView = { metric: "episodes" | "shows" | "hours"; period: "week" | "month"; target: number; current: number; endsAt: string };

function periodStart(period: "week" | "month") {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  else d.setDate(1);
  return d;
}

function periodEnd(period: "week" | "month") {
  const d = periodStart(period);
  if (period === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function getGoals(userId: string): Promise<GoalView[]> {
  const goals = await prisma.watchGoal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return Promise.all(
    goals.map(async (g) => {
      const period = g.period === "month" ? "month" : "week";
      const start = periodStart(period);
      let current = 0;
      if (g.metric === "hours") current = Math.round(((await totalSeconds(userId, start)) / 3600) * 10) / 10;
      else if (g.metric === "episodes") current = (await watchedEpisodes(userId, start)).length;
      else current = await prisma.listEntry.count({ where: { userId, status: "COMPLETED", completedAt: { gte: start } } });
      return { metric: g.metric as GoalView["metric"], period, target: g.target, current, endsAt: periodEnd(period).toISOString() };
    }),
  );
}
