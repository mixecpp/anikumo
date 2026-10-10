-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#e11d48',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "episode" INTEGER NOT NULL,
    "progressSeconds" REAL NOT NULL DEFAULT 0,
    "durationSeconds" REAL NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "episode" INTEGER,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibrarySeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderName" TEXT NOT NULL,
    "anilistId" INTEGER,
    "title" TEXT,
    "coverImage" TEXT,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LibraryEpisode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL,
    "relativePath" TEXT NOT NULL,
    "subtitlePath" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LibraryEpisode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "LibrarySeries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "WatchProgress_userId_updatedAt_idx" ON "WatchProgress"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_anilistId_episode_key" ON "WatchProgress"("userId", "anilistId", "episode");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_anilistId_key" ON "Favorite"("userId", "anilistId");

-- CreateIndex
CREATE INDEX "Comment_anilistId_episode_createdAt_idx" ON "Comment"("anilistId", "episode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LibrarySeries_folderName_key" ON "LibrarySeries"("folderName");

-- CreateIndex
CREATE INDEX "LibrarySeries_anilistId_idx" ON "LibrarySeries"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEpisode_seriesId_episode_key" ON "LibraryEpisode"("seriesId", "episode");
