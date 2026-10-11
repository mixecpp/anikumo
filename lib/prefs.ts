import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { getUserId } from "./auth";
import { normalizePrefs, type Prefs } from "./prefs-shared";

export const PREFS_COOKIE = "aw_prefs";

/** Preferences for the current request: account prefs when logged in, otherwise the guest cookie. */
export const getPrefs = cache(async (): Promise<Prefs> => {
  const userId = await getUserId();
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
    if (u) return normalizePrefs(safeParse(u.preferences));
  }
  const jar = await cookies();
  return normalizePrefs(safeParse(jar.get(PREFS_COOKIE)?.value));
});

export function safeParse(s: string | undefined | null): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
