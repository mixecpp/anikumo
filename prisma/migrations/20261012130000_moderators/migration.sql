-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#e11d48',
    "avatar" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bio" TEXT NOT NULL DEFAULT '',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" DATETIME,
    "muteReason" TEXT NOT NULL DEFAULT '',
    "profilePublic" BOOLEAN NOT NULL DEFAULT false,
    "profileVisibility" TEXT NOT NULL DEFAULT 'private',
    "profileSections" TEXT NOT NULL DEFAULT '{}',
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "onLeaderboard" BOOLEAN NOT NULL DEFAULT true,
    "allowFollows" BOOLEAN NOT NULL DEFAULT true,
    "profileBanner" TEXT NOT NULL DEFAULT '',
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryCodes" TEXT NOT NULL DEFAULT '[]',
    "recoveryKeyHash" TEXT,
    "bannedAt" DATETIME,
    "banReason" TEXT NOT NULL DEFAULT '',
    "calendarToken" TEXT,
    "discordWebhook" TEXT,
    "preferences" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "new_User" ("allowFollows", "avatar", "avatarColor", "banReason", "bannedAt", "bio", "calendarToken", "createdAt", "discordWebhook", "id", "isAdmin", "onLeaderboard", "passwordHash", "preferences", "profileBanner", "profilePublic", "profileSections", "profileVisibility", "recoveryCodes", "recoveryKeyHash", "searchable", "totpEnabled", "totpSecret", "username") SELECT "allowFollows", "avatar", "avatarColor", "banReason", "bannedAt", "bio", "calendarToken", "createdAt", "discordWebhook", "id", "isAdmin", "onLeaderboard", "passwordHash", "preferences", "profileBanner", "profilePublic", "profileSections", "profileVisibility", "recoveryCodes", "recoveryKeyHash", "searchable", "totpEnabled", "totpSecret", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

