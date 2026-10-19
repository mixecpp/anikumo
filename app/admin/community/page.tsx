import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth";
import { announcementHistory, chatSettings, messagesSince, onlineCount } from "@/lib/chat";
import CommunityAdmin from "@/components/admin/CommunityAdmin";

export const metadata: Metadata = { title: "Community · Admin" };
export const dynamic = "force-dynamic";

export default async function CommunityAdminPage() {
  const staff = await requireStaffPage();
  const isAdmin = staff.role === "admin" || staff.role === "owner";
  const day = new Date(Date.now() - 86_400_000);
  const [settings, history, recent, today, chatters] = await Promise.all([
    chatSettings(),
    isAdmin ? announcementHistory() : Promise.resolve([]),
    messagesSince(null),
    prisma.chatMessage.count({ where: { createdAt: { gt: day } } }),
    prisma.chatMessage.groupBy({ by: ["userId"], where: { createdAt: { gt: day } } }).then((r) => r.length),
  ]);
  return <CommunityAdmin isAdmin={isAdmin} initial={{ settings, history, recent: recent.slice(-40).reverse(), stats: { online: onlineCount(), today, chatters } }} />;
}
