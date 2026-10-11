import { prisma } from "./db";
import { rateLimit } from "./rate-limit";

type ErrorInput = { source: "server" | "client"; message: string; stack?: string; digest?: string; path?: string; userId?: string | null };

/** Persists an error for the admin dashboard. Never throws; floods are capped. */
export async function logError(e: ErrorInput) {
  try {
    if (!rateLimit("errorlog", 120, 60_000).ok) return;
    await prisma.errorLog.create({
      data: {
        source: e.source,
        message: e.message.slice(0, 1000),
        stack: (e.stack ?? "").slice(0, 8000),
        digest: (e.digest ?? "").slice(0, 100),
        path: (e.path ?? "").slice(0, 500),
        userId: e.userId ?? null,
      },
    });
  } catch {
    // logging must never break the request
  }
}
