import { prisma } from "./db";

export * from "./privacy-shared";

/** Can this viewer open the profile? Owners always can; "followers" means people who follow them. */
export async function canViewProfile(owner: { id: string; profileVisibility: string }, viewerId: string | null) {
  if (viewerId === owner.id) return true;
  if (owner.profileVisibility === "everyone") return true;
  if (owner.profileVisibility !== "followers" || !viewerId) return false;
  const f = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: owner.id } }, select: { followerId: true } });
  return !!f;
}
