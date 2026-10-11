import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { normalizePrefs } from "@/lib/prefs-shared";
import { PREFS_COOKIE, getPrefs } from "@/lib/prefs";

/** Merges a partial preferences update. Saved to the account when logged in, otherwise a cookie. */
export async function PATCH(req: Request) {
  const patch = await readJson<Record<string, unknown>>(req);
  const current = await getPrefs();
  const next = normalizePrefs({ ...current, ...patch, shortcuts: { ...current.shortcuts, ...((patch.shortcuts as object) ?? {}) } });
  const json = JSON.stringify(next);

  const userId = await getUserId();
  if (userId) await prisma.user.update({ where: { id: userId }, data: { preferences: json } });
  const jar = await cookies();
  jar.set(PREFS_COOKIE, json, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  return NextResponse.json({ ok: true, prefs: next });
}
