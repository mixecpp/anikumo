/** Staff ranks (shared with client components). Owner > admin > moderator > user. */
export type Role = "owner" | "admin" | "moderator" | "user";
export const RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2, owner: 3 };
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", moderator: "Moderator", user: "Member" };

/** Can someone with role `a` act on someone with role `b`? Only on people ranked below them. */
export const rankAbove = (a: Role, b: Role) => RANK[a] > RANK[b];
