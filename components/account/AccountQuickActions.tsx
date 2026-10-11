"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, LogOut, Megaphone, Shield } from "lucide-react";
import { toast } from "@/lib/toast";
import { useT } from "../PrefsProvider";
import { NewDot, useChangelogUnseen } from "../WhatsNew";

/** Phones/tablets have no top-right account menu, so its extra actions live here. */
export default function AccountQuickActions({ username, profilePublic, isAdmin, latestChangelog }: { username: string; profilePublic: boolean; isAdmin: boolean; latestChangelog: string | null }) {
  const router = useRouter();
  const t = useT();
  const unseen = useChangelogUnseen(latestChangelog);
  const chip = "chip !gap-1.5 !px-3 !py-1.5 !text-xs";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast("Logged out", "info");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="scrollbar-none -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 lg:hidden">
      <Link href="/changelog" className={chip}>
        <Megaphone className="h-3.5 w-3.5" /> What&apos;s new {unseen && <NewDot />}
      </Link>
      {profilePublic && (
        <Link href={`/u/${username}`} className={chip}>
          <Globe className="h-3.5 w-3.5" /> {t("menu.profile")}
        </Link>
      )}
      {isAdmin && (
        <Link href="/admin" className={chip}>
          <Shield className="h-3.5 w-3.5" /> {t("menu.admin")}
        </Link>
      )}
      <button onClick={logout} className={`${chip} text-muted`}>
        <LogOut className="h-3.5 w-3.5" /> {t("menu.logout")}
      </button>
    </div>
  );
}
