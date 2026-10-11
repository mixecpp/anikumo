import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fail } from "@/lib/http";
import { getAdminMetrics } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Polled by the admin overview every few seconds. */
export async function GET() {
  if (!(await requireAdmin())) return fail("Admins only", 403);
  return NextResponse.json(await getAdminMetrics(), { headers: { "Cache-Control": "no-store" } });
}
