import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import SettingsForms from "@/components/account/SettingsForms";
import { readWebhook } from "@/lib/notifications";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const userId = (await requirePageUserId("/account/settings"));
  const [u, prefs] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, avatarColor: true, avatar: true, bio: true, profilePublic: true, discordWebhook: true, calendarToken: true, totpEnabled: true, recoveryKeyHash: true },
    }),
    getPrefs(),
  ]);
  return (
    <SettingsForms
      prefs={prefs}
      user={{
        username: u.username,
        avatarColor: u.avatarColor,
        avatar: u.avatar,
        bio: u.bio,
        profilePublic: u.profilePublic,
        discordWebhook: readWebhook(u.discordWebhook),
        calendarOn: !!u.calendarToken,
        totpEnabled: u.totpEnabled,
        hasRecoveryKey: !!u.recoveryKeyHash,
      }}
    />
  );
}
