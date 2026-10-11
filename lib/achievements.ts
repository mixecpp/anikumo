import type { AccountStats } from "./account";

export type Achievement = { id: string; label: string; detail: string; earned: boolean; progress: number };

type Extra = { longestCompletedEpisodes: number; customLists: number; following: number };

/** Small, quiet milestones computed from stats — nothing is stored. */
export function computeAchievements(s: AccountStats, x: Extra): Achievement[] {
  const hours = s.secondsWatched / 3600;
  const defs: [string, string, string, number, number][] = [
    ["first-episode", "First steps", "Watch your first episode", s.episodesWatched, 1],
    ["ep-100", "Century", "Watch 100 episodes", s.episodesWatched, 100],
    ["ep-500", "Marathoner", "Watch 500 episodes", s.episodesWatched, 500],
    ["hours-24", "A full day", "24 hours of active watching", hours, 24],
    ["hours-100", "Dedicated", "100 hours of active watching", hours, 100],
    ["streak-7", "Week streak", "Watch 7 days in a row", s.longestStreak, 7],
    ["streak-30", "Habit formed", "Watch 30 days in a row", s.longestStreak, 30],
    ["complete-10", "Finisher", "Complete 10 shows", s.showsCompleted, 10],
    ["long-50", "Long haul", "Complete a 50+ episode show", x.longestCompletedEpisodes, 50],
    ["critic", "Critic", "Write 3 reviews", s.reviews, 3],
    ["curator", "Curator", "Make a custom list", x.customLists, 1],
    ["social", "Social", "Follow 3 people", x.following, 3],
  ];
  return defs.map(([id, label, detail, value, target]) => ({ id, label, detail, earned: value >= target, progress: Math.min(1, value / target) }));
}
