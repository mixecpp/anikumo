import { prisma } from "./db";
import { getSeason, titleOf } from "./anilist";

export type PollOption = { anilistId: number; title: string; cover: string };

/** The poll for a season, created on first view from the season's 10 most popular shows. */
export async function getSeasonPoll(season: string, seasonYear: number, userId: string | null) {
  let poll = await prisma.poll.findUnique({ where: { season_seasonYear: { season, seasonYear } } });
  if (!poll) {
    const media = await getSeason(season, seasonYear).catch(() => []);
    const options: PollOption[] = media.filter((m) => m.format === "TV" || m.format === "ONA").slice(0, 10).map((m) => ({ anilistId: m.id, title: titleOf(m), cover: m.coverImage.large }));
    if (options.length < 2) return null;
    const label = season.charAt(0) + season.slice(1).toLowerCase();
    poll = await prisma.poll
      .create({ data: { title: `Best show of ${label} ${seasonYear}?`, season, seasonYear, options: JSON.stringify(options) } })
      .catch(() => prisma.poll.findUniqueOrThrow({ where: { season_seasonYear: { season, seasonYear } } }));
  }
  const options: PollOption[] = JSON.parse(poll.options);
  const [groups, mine] = await Promise.all([
    prisma.pollVote.groupBy({ by: ["anilistId"], where: { pollId: poll.id }, _count: true }),
    userId ? prisma.pollVote.findUnique({ where: { pollId_userId: { pollId: poll.id, userId } } }) : null,
  ]);
  const counts = Object.fromEntries(groups.map((g) => [g.anilistId, g._count]));
  return { id: poll.id, title: poll.title, options, counts, total: groups.reduce((n, g) => n + g._count, 0), myVote: mine?.anilistId ?? null };
}
