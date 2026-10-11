import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, requireUserId } from "@/lib/http";
import { getPlaybackSettings } from "@/lib/playback/server";
import { normalizeSettings, settingsPatch } from "@/lib/playback/settings";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  return NextResponse.json({ settings: await getPlaybackSettings(userId) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  if (req.headers.get("X-Account-Id") && req.headers.get("X-Account-Id") !== userId) return fail("Account changed. Reload the watch page.", 409);
  let patch;
  try { patch = settingsPatch(await req.json()); } catch (error) { return fail(error instanceof Error ? error.message : "Invalid settings"); }
  if (!Object.keys(patch).length) return fail("No settings supplied");
  const row = await prisma.playbackSettings.upsert({ where: { userId }, create: { userId, ...patch }, update: patch });
  return NextResponse.json({ settings: normalizeSettings(row) }, { headers: { "Cache-Control": "private, no-store" } });
}
