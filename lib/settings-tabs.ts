/** The account settings pages (shared by the settings page on the server and its forms). */
export type SettingsTab = "account" | "privacy" | "preferences" | "notifications" | "security" | "data";
export const SETTINGS_TABS: { id: SettingsTab; title: string; description: string }[] = [
  { id: "account", title: "Account", description: "Your username, picture colour and password." },
  { id: "privacy", title: "Privacy", description: "Who can see your profile, what they see and who can comment." },
  { id: "preferences", title: "Preferences", description: "How AniKumo looks and reads." },
  { id: "notifications", title: "Notifications", description: "Optional extras on top of the bell on this site." },
  { id: "security", title: "Security", description: "Recovery key, two-factor authentication and signed-in devices." },
  { id: "data", title: "Import & data", description: "Bring your list in, take your data out, or delete your account." },
];
