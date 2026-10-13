import type { Metadata } from "next";
import { Suspense } from "react";
import { PRIVATE } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getUser, isAdminUser, roleOf } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AccountShell from "@/components/account/AccountShell";

export const metadata: Metadata = PRIVATE;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/account");
  const latest = await prisma.changelogEntry.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const staffLink = isAdminUser(user) ? { href: "/admin", label: "Admin" } : roleOf(user) === "moderator" ? { href: "/admin/moderation", label: "Moderation" } : null;

  return (
    <Suspense>
      <AccountShell
        user={{ username: user.username, avatarColor: user.avatarColor, avatar: user.avatar, since: user.createdAt.toISOString() }}
        staffLink={staffLink}
        latestChangelog={latest?.createdAt.toISOString() ?? null}
      >
        {children}
      </AccountShell>
    </Suspense>
  );
}
