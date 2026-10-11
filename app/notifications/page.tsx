import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { syncEpisodeAlerts } from "@/lib/notifications";
import { getUi } from "@/lib/server-i18n";
import NotificationsView from "@/components/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/notifications");
  await syncEpisodeAlerts(userId).catch(() => {});
  const [{ t }, rows] = await Promise.all([getUi(), prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 })]);
  return (
    <div className="mx-auto max-w-[800px] px-4 pt-10 md:px-8">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t("notif.title")}</h1>
      <NotificationsView
        initial={rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, href: r.href, image: r.image, readAt: r.readAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
