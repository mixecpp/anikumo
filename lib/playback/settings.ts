export type PlaybackSettings = {
  audioTrack: "sub" | "dub";
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  autoplayNext: boolean;
  autoplay: boolean;
  resume: boolean;
  volume: number;
  muted: boolean;
};

export const defaultPlaybackSettings: PlaybackSettings = {
  audioTrack: "sub", autoSkipIntro: false, autoSkipOutro: false,
  autoplayNext: true, autoplay: false, resume: true, volume: 1, muted: false,
};

export function settingsPatch(value: unknown): Partial<PlaybackSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected settings object");
  const input = value as Record<string, unknown>;
  const result: Partial<PlaybackSettings> = {};
  for (const [key, val] of Object.entries(input)) {
    if (!Object.hasOwn(defaultPlaybackSettings, key)) throw new Error(`Unknown setting: ${key}`);
    if (key === "audioTrack") {
      if (val !== "sub" && val !== "dub") throw new Error("audioTrack must be sub or dub");
      result.audioTrack = val;
    } else if (key === "volume") {
      if (typeof val !== "number" || !Number.isFinite(val) || val < 0 || val > 1) throw new Error("volume must be between 0 and 1");
      result.volume = val;
    } else {
      if (typeof val !== "boolean") throw new Error(`${key} must be boolean`);
      (result as Record<string, unknown>)[key] = val;
    }
  }
  return result;
}

export function normalizeSettings(value: unknown): PlaybackSettings {
  const result = { ...defaultPlaybackSettings };
  if (!value || typeof value !== "object") return result;
  for (const key of Object.keys(result)) {
    try { Object.assign(result, settingsPatch({ [key]: (value as Record<string, unknown>)[key] })); } catch {}
  }
  return result;
}
