import { NextResponse } from "next/server";
import { scanLibrary } from "@/lib/library";
import { fail, requireUserId } from "@/lib/http";

export async function POST() {
  if (!(await requireUserId())) return fail("Log in to scan the library", 401);
  const report = await scanLibrary();
  return NextResponse.json(report, { status: report.error ? 400 : 200 });
}
