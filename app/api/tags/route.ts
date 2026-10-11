import { NextResponse } from "next/server";
import { getTagCollection } from "@/lib/anilist";

export async function GET() {
  try {
    return NextResponse.json({ tags: await getTagCollection() }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ tags: [] });
  }
}
