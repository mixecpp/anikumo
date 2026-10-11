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
    "profilePublic" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_User" ("avatarColor", "banReason", "bannedAt", "bio", "calendarToken", "createdAt", "discordWebhook", "id", "isAdmin", "passwordHash", "preferences", "profilePublic", "recoveryCodes", "recoveryKeyHash", "totpEnabled", "totpSecret", "username") SELECT "avatarColor", "banReason", "bannedAt", "bio", "calendarToken", "createdAt", "discordWebhook", "id", "isAdmin", "passwordHash", "preferences", "profilePublic", "recoveryCodes", "recoveryKeyHash", "totpEnabled", "totpSecret", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

