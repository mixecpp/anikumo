export const REACTIONS = [
  { id: "peak", emoji: "🔥", label: "Peak" },
  { id: "lol", emoji: "😂", label: "Funny" },
  { id: "cry", emoji: "😭", label: "Emotional" },
  { id: "wow", emoji: "😮", label: "Shocking" },
  { id: "love", emoji: "❤️", label: "Loved it" },
  { id: "meh", emoji: "😴", label: "Slow" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];

export function isReaction(v: unknown): v is ReactionId {
  return REACTIONS.some((r) => r.id === v);
}
