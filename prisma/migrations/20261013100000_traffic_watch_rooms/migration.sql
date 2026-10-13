-- CreateTable
CREATE TABLE "TrafficDay" (
    "day" TEXT NOT NULL PRIMARY KEY,
    "views" INTEGER NOT NULL DEFAULT 0,
    "guestViews" INTEGER NOT NULL DEFAULT 0,
    "mobileViews" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "guests" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "TrafficVisitor" (
    "day" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "guest" BOOLEAN NOT NULL,

    PRIMARY KEY ("day", "hash")
);

-- CreateTable
CREATE TABLE "TrafficPage" (
    "day" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("day", "path")
);

-- CreateTable
CREATE TABLE "WatchRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "anilistId" INTEGER NOT NULL,
    "episode" INTEGER NOT NULL,
    "animeTitle" TEXT NOT NULL DEFAULT '',
    "animeCover" TEXT NOT NULL DEFAULT '',
    "position" REAL NOT NULL DEFAULT 0,
    "positionAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playing" BOOLEAN NOT NULL DEFAULT false,
    "chatOn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "WatchRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchRoomMember" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kicked" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("roomId", "userId"),
    CONSTRAINT "WatchRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WatchRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchRoomMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchRoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WatchRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchRoomMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrafficPage_day_views_idx" ON "TrafficPage"("day", "views");

-- CreateIndex
CREATE UNIQUE INDEX "WatchRoom_code_key" ON "WatchRoom"("code");

-- CreateIndex
CREATE INDEX "WatchRoom_isPublic_closedAt_lastActiveAt_idx" ON "WatchRoom"("isPublic", "closedAt", "lastActiveAt");

-- CreateIndex
CREATE INDEX "WatchRoom_hostId_idx" ON "WatchRoom"("hostId");

-- CreateIndex
CREATE INDEX "WatchRoomMember_roomId_lastSeenAt_idx" ON "WatchRoomMember"("roomId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "WatchRoomMessage_roomId_createdAt_idx" ON "WatchRoomMessage"("roomId", "createdAt");

