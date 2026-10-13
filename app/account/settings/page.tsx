import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrefs } from "@/lib/prefs";
import SettingsForms from "@/components/account/SettingsForms";
import { SETTINGS_TABS, type SettingsTab } from "@/lib/settings-tabs";
import { readWebhook } from "@/lib/notifications";
import { isVisibility, isWallSetting, parseSections } from "@/lib/privacy-shared";

export const metadata: Metadata = { title: "Settings" };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const requested = (await searchParams).tab;
  const tab: SettingsTab = SETTINGS_TABS.some((t) => t.id === requested) ? (requested as SettingsTab) : "account";
  const userId = (await requirePageUserId("/account/settings"));
  const [u, prefs] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { username: true, avatarColor: true, avatar: true, bio: true, profileBanner: true, profileVisibility: true, profileSections: true, searchable: true, onLeaderboard: true, allowFollows: true, profileComments: true, discordWebhook: true, calendarToken: true, totpEnabled: true, recoveryKeyHash: true },
    }),
    getPrefs(),
  ]);
  return (
    <SettingsForms
      tab={tab}
      prefs={prefs}
      user={{
        username: u.username,
        avatarColor: u.avatarColor,
        avatar: u.avatar,
        bio: u.bio,
        privacy: {
          username: u.username,
          bio: u.bio,
          profileBanner: u.profileBanner,
          profileVisibility: isVisibility(u.profileVisibility) ? u.profileVisibility : "private",
          profileSections: parseSections(u.profileSections),
          searchable: u.searchable,
          onLeaderboard: u.onLeaderboard,
          allowFollows: u.allowFollows,
          profileComments: isWallSetting(u.profileComments) ? u.profileComments : "everyone",
        },
        discordWebhook: readWebhook(u.discordWebhook),
        calendarOn: !!u.calendarToken,
        totpEnabled: u.totpEnabled,
        hasRecoveryKey: !!u.recoveryKeyHash,
      }}
    />
  );
}
