import type { Instrumentation } from "next";

/** Persists server-side request errors for the admin dashboard. */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/errors");
  const e = err as Error & { digest?: string };
  await logError({ source: "server", message: e.message ?? String(err), stack: e.stack, digest: e.digest, path: request.path });
};

/** Starts the background AniList refresher (lib/warm.ts) once the server is up. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { installCacheStore } = await import("./lib/cache-store");
  installCacheStore();
  const { startWarmer } = await import("./lib/warm");
  startWarmer();
}
