import { prisma } from "@/lib/db";
import { fail, requireUserId } from "@/lib/http";

/** Everything stored about the user, as a downloadable JSON file. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);

  const [user, watchTime] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        username: true,
        bio: true,
        createdAt: true,
        preferences: true,
        progress: { select: { anilistId: true, title: true, episode: true, progressSeconds: true, durationSeconds: true, completed: true, updatedAt: true }, orderBy: { updatedAt: "desc" } },
        listEntries: { select: { anilistId: true, title: true, status: true, score: true, progress: true, notes: true, tags: true, rewatchCount: true, startedAt: true, completedAt: true, updatedAt: true } },
        favorites: { select: { anilistId: true, title: true, addedAt: true }, orderBy: { addedAt: "desc" } },
        comments: { select: { anilistId: true, episode: true, body: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        reviews: { select: { anilistId: true, score: true, title: true, body: true, createdAt: true } },
        customLists: { select: { title: true, description: true, isPublic: true, items: { select: { anilistId: true, title: true, note: true, position: true } } } },
        goals: { select: { metric: true, period: true, target: true } },
        presets: { select: { name: true, query: true } },
      },
    }),
    prisma.watchTime.findMany({ where: { userId }, select: { anilistId: true, episode: true, day: true, seconds: true }, orderBy: { day: "asc" } }),
  ]);

  const file = JSON.stringify({ exportedAt: new Date().toISOString(), ...user, watchTime }, null, 2);
  return new Response(file, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="anikumo-${user.username}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
