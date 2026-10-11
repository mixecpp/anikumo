-- DropIndex
DROP INDEX "AuthToken_userId_type_idx";

-- DropIndex
DROP INDEX "AuthToken_tokenHash_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AuthToken";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DevMail";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#e11d48',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bio" TEXT NOT NULL DEFAULT '',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "profilePublic" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryCodes" TEXT NOT NULL DEFAULT '[]',
    "recoveryKeyHash" TEXT,
    "calendarToken" TEXT,
    "discordWebhook" TEXT,
    "preferences" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "new_User" ("avatarColor", "bio", "calendarToken", "createdAt", "discordWebhook", "id", "isAdmin", "passwordHash", "preferences", "profilePublic", "recoveryCodes", "totpEnabled", "totpSecret", "username") SELECT "avatarColor", "bio", "calendarToken", "createdAt", "discordWebhook", "id", "isAdmin", "passwordHash", "preferences", "profilePublic", "recoveryCodes", "totpEnabled", "totpSecret", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

