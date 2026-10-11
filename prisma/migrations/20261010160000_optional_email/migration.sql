-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#e11d48',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bio" TEXT NOT NULL DEFAULT '',
    "emailVerifiedAt" DATETIME,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "profilePublic" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryCodes" TEXT NOT NULL DEFAULT '[]',
    "calendarToken" TEXT,
    "discordWebhook" TEXT,
    "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
    "preferences" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "new_User" ("avatarColor", "bio", "calendarToken", "createdAt", "discordWebhook", "email", "emailAlerts", "emailVerifiedAt", "id", "isAdmin", "passwordHash", "preferences", "profilePublic", "recoveryCodes", "totpEnabled", "totpSecret", "username") SELECT "avatarColor", "bio", "calendarToken", "createdAt", "discordWebhook", "email", "emailAlerts", "emailVerifiedAt", "id", "isAdmin", "passwordHash", "preferences", "profilePublic", "recoveryCodes", "totpEnabled", "totpSecret", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
