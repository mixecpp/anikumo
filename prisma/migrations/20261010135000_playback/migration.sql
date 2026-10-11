ALTER TABLE "WatchProgress" ADD COLUMN "sampledAt" REAL NOT NULL DEFAULT 0;
CREATE TABLE "PlaybackSettings" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "audioTrack" TEXT NOT NULL DEFAULT 'sub',
  "autoSkipIntro" BOOLEAN NOT NULL DEFAULT false,
  "autoSkipOutro" BOOLEAN NOT NULL DEFAULT false,
  "autoplayNext" BOOLEAN NOT NULL DEFAULT true,
  "autoplay" BOOLEAN NOT NULL DEFAULT false,
  "resume" BOOLEAN NOT NULL DEFAULT true,
  "volume" REAL NOT NULL DEFAULT 1,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlaybackSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
