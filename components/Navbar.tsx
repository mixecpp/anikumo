import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUser, isAdminUser, roleOf } from "@/lib/auth";
import { navMenu } from "@/lib/nav";
import { syncEpisodeAlerts, unreadCount } from "@/lib/notifications";
import SearchBox from "./SearchBox";
import UserMenu from "./UserMenu";
import NavLinks from "./NavLinks";
import NavShell from "./NavShell";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";

export default async function Navbar({ libraryEnabled }: { libraryEnabled: boolean }) {
  const [user, latest] = await Promise.all([getUser(), prisma.changelogEntry.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } })]);
  let unread = 0;
  let profilePublic = false;
  if (user) {
    // Episode alerts are checked in the background (throttled to every 10 minutes per user).
    syncEpisodeAlerts(user.id).catch(() => {});
    const [count, row] = await Promise.all([unreadCount(user.id), prisma.user.findUnique({ where: { id: user.id }, select: { profilePublic: true, isAdmin: true, username: true } })]);
    unread = count;
    profilePublic = !!row?.profilePublic;
  }
  return (
    <NavShell>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 md:gap-6 md:px-8">
        <Link href="/" aria-label="AniKumo home" className="shrink-0">
          <Logo />
        </Link>
        <NavLinks menu={navMenu(libraryEnabled)} />
        <div className="flex flex-1 justify-end">
          <SearchBox />
        </div>
        {user && <NotificationBell initialUnread={unread} />}
        <div className="hidden lg:block">
        <UserMenu
          latestChangelog={latest?.createdAt.toISOString() ?? null}
          user={user ? { username: user.username, avatarColor: user.avatarColor, avatar: user.avatar, isAdmin: isAdminUser(user), isModerator: roleOf(user) === "moderator", profilePublic } : null}
        />
        </div>
      </nav>
    </NavShell>
  );
}
