import { NextResponse } from "next/server";
import { scanLibrary } from "@/lib/library";
import { fail } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  if (!(await requireAdmin())) return fail("Only admins can scan the library", 403);
  const report = await scanLibrary();
  return NextResponse.json(report, { status: report.error ? 400 : 200 });
}
