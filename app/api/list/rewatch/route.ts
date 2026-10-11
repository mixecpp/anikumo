import { NextResponse } from "next/server";
import { fail, readJson, requireUserId, toInt } from "@/lib/http";
import { advanceRewatch, toDTO } from "@/lib/list";

/** Called when an episode finishes while a rewatch is active. */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const body = await readJson<{ anilistId: number; episode: number }>(req);
  const anilistId = toInt(body.anilistId);
  const episode = toInt(body.episode);
  if (!anilistId || !episode || episode < 1) return fail("anilistId and episode required");
  const row = await advanceRewatch(userId, anilistId, episode);
  return NextResponse.json({ entry: row ? toDTO(row) : null });
}
