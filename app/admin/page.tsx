import type { Metadata } from "next";
import { getAdminMetrics } from "@/lib/admin";
import { requireAdminPage } from "@/lib/auth";
import LiveOverview from "@/components/admin/LiveOverview";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdminPage();
  return <LiveOverview initial={await getAdminMetrics()} />;
}
