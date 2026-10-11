import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Avatar } from "@/components/UserMenu";
import AccountNav from "@/components/account/AccountNav";

export const metadata: Metadata = PRIVATE;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/account");

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 md:px-8">
      <header className="flex items-center gap-4">
        <Avatar name={user.username} color={user.avatarColor} avatar={user.avatar} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{user.username}</h1>
          <p className="text-sm text-muted">
            Member since {user.createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
        </div>
      </header>
      <AccountNav />
      <div className="pt-8">{children}</div>
    </div>
  );
}
