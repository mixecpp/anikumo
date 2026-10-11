import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, readJson, requireUserId } from "@/lib/http";
import { browseQuery, parseBrowseParams } from "@/lib/browse-params";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ presets: [] });
  const presets = await prisma.browsePreset.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ presets });
}

/** POST { name, query } saves the current browse filters (re-validated server-side). */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Log in to save views", 401);
  const b = await readJson<{ name: string; query: string }>(req);
  const name = String(b.name ?? "").trim().slice(0, 40);
  if (!name) return fail("Name your view");
  const query = browseQuery(parseBrowseParams(Object.fromEntries(new URLSearchParams(String(b.query ?? "")))));
  if (!query) return fail("Pick some filters first");
  if ((await prisma.browsePreset.count({ where: { userId } })) >= 20) return fail("You can save up to 20 views");
  const preset = await prisma.browsePreset.create({ data: { userId, name, query } });
  return NextResponse.json({ preset });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return fail("Not logged in", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("id required");
  await prisma.browsePreset.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
