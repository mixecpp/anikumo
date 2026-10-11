-- CreateTable
CREATE TABLE "WatchTime" (
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "episode" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "seconds" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "anilistId", "episode", "day")
);

-- CreateTable
CREATE TABLE "WatchCursor" (
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "episode" INTEGER NOT NULL,
    "position" REAL NOT NULL,
    "sampledAt" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "anilistId", "episode")
);

-- CreateIndex
CREATE INDEX "WatchTime_userId_day_idx" ON "WatchTime"("userId", "day");

-- CreateIndex
CREATE INDEX "WatchTime_day_idx" ON "WatchTime"("day");
