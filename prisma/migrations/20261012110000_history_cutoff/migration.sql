-- CreateTable
CREATE TABLE "HistoryCutoff" (
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "before" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "anilistId")
);

