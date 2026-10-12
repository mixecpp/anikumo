-- CreateTable
CREATE TABLE "CacheEntry" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CacheEntry_expires_idx" ON "CacheEntry"("expires");

