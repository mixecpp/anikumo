import type { PlaybackSettings } from "./settings";

export type PlaybackSource = {
  url: string;
  fallbackUrl: string;
  protocol: "flixcloud" | "aniweeb";
  controls: boolean;
};

/** Inspect the public wrapper config without executing upstream code or exposing stream tokens. */
export function parseAniweebPlayer(html: string, fallbackUrl: string): PlaybackSource {
  const fallback: PlaybackSource = { url: fallbackUrl, fallbackUrl, protocol: "aniweeb", controls: false };
  if (html.length > 1_000_000) return fallback;
  const match = html.match(/window\.__ANIWEEB_PLAYER\s*=\s*([\s\S]*?);\s*<\/script>/);
  if (!match) return fallback;
  try {
    const config = JSON.parse(match[1]);
    if (typeof config.iframe !== "string") return fallback;
    const url = new URL(config.iframe);
    if (url.protocol !== "https:" || url.hostname !== "flixcloud.cc" || url.port || url.username || url.password || !/^\/e\/[a-z0-9]+\/?$/i.test(url.pathname)) return fallback;
    return { url: url.href, fallbackUrl, protocol: "flixcloud", controls: true };
  } catch { return fallback; }
}

export function playbackUrl(source: PlaybackSource, settings: PlaybackSettings, resumeAt: number) {
  const url = new URL(source.url);
  if (source.protocol === "flixcloud") {
    // Confirmed public player parameters. a=1 selects English in the same multi-audio player.
    url.searchParams.set("a", settings.audioTrack === "dub" ? "1" : "0");
    url.searchParams.set("skI", String(settings.autoSkipIntro));
    url.searchParams.set("skO", String(settings.autoSkipOutro));
    url.searchParams.set("autoplay", String(settings.autoplay));
    if (settings.resume && Number.isFinite(resumeAt) && resumeAt > 0) url.searchParams.set("start_at", String(Math.floor(resumeAt)));
    else url.searchParams.delete("start_at");
  } else {
    url.searchParams.set("track", settings.audioTrack);
  }
  return url.href;
}

export type PlayerMessage =
  | { type: "time"; current: number; duration: number }
  | { type: "status"; status: "Playing" | "Paused" | "Ended" | "Loading" }
  | { type: "fullscreen" }
  | { type: "error" };

export function decodePlayerMessage(source: PlaybackSource, data: unknown): PlayerMessage | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (source.protocol === "flixcloud") {
    if (["Playing", "Paused", "Ended", "Loading"].includes(d.playerStatus as string)) return { type: "status", status: d.playerStatus as "Playing" | "Paused" | "Ended" | "Loading" };
    if (d.zenCommand === "toggleFullscreen" || d.zenCommand === "getFullscreenState") return { type: "fullscreen" };
  } else {
    if (d.event === "error") return { type: "error" };
    if (d.event === "complete") return { type: "status", status: "Ended" };
    if (d.event !== "time") return null;
  }
  const current = source.protocol === "flixcloud" ? d.currentTime : d.time;
  const duration = d.duration;
  if (typeof current !== "number" || typeof duration !== "number" || !Number.isFinite(current) || !Number.isFinite(duration) || current < 0 || duration <= 0 || duration > 86400 || current > duration + 5) return null;
  return { type: "time", current: Math.min(current, duration), duration };
}
