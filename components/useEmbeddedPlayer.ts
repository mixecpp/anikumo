"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { decodePlayerMessage, type PlaybackSource } from "@/lib/playback/source";
import type { PlaybackSettings } from "@/lib/playback/settings";

type Skip = { type: "op" | "ed"; start: number; end: number };
type Callbacks = { sample: (current: number, duration: number) => void; pause: () => void; ended: () => void };

export function useEmbeddedPlayer(frame: RefObject<HTMLIFrameElement | null>, wrap: RefObject<HTMLDivElement | null>, source: PlaybackSource, playerUrl: string, settings: PlaybackSettings, resumeAt: number, skips: Skip[], callbacks: Callbacks) {
  const [connected, setConnected] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const state = useRef({ settings, skips, callbacks, connected: false, resumed: false, ended: false, current: 0, duration: 0, skipEnd: 0, pausePending: false, status: "Loading" });
  state.current.settings = settings;
  state.current.skips = skips;
  state.current.callbacks = callbacks;

  const command = useCallback((command: string, value?: unknown) => {
    if (!source.controls) return;
    frame.current?.contentWindow?.postMessage({ command, value }, new URL(source.url).origin);
  }, [frame, source.controls, source.url]);

  useEffect(() => {
    setConnected(false); setPlayerError(false); setTime(0); setDuration(0); setPlaying(false);
    state.current.connected = false; state.current.resumed = false; state.current.ended = false; state.current.skipEnd = 0; state.current.status = "Loading"; state.current.pausePending = false;
    const expectedOrigin = new URL(source.url).origin;
    const apply = () => {
      const s = state.current.settings;
      command("updatePreferences", { skipIntro: s.autoSkipIntro, skipOutro: s.autoSkipOutro, autoPlay: s.autoplay });
      command("volume", s.volume);
      command(s.muted ? "mute" : "unmute");
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin || event.source !== frame.current?.contentWindow) return;
      const message = decodePlayerMessage(source, event.data);
      if (!message) return;
      const s = state.current;
      if (message.type === "fullscreen") {
        if (event.data.zenCommand === "toggleFullscreen") {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          else void wrap.current?.requestFullscreen().catch(() => {});
        }
        frame.current?.contentWindow?.postMessage({ zenFullscreenState: !!document.fullscreenElement }, expectedOrigin);
        return;
      }
      if (message.type === "error") { setPlayerError(true); return; }
      if (!s.connected && (message.type === "time" || (message.type === "status" && message.status !== "Loading"))) { s.connected = true; setConnected(true); apply(); }
      if (message.type === "status") {
        setPlaying(message.status === "Playing");
        if (message.status === "Paused" && s.status !== "Paused") { s.pausePending = true; command("getTime"); }
        s.status = message.status;
        if (message.status === "Ended" && !s.ended) { s.ended = true; s.callbacks.ended(); }
        return;
      }
      const { current, duration } = message;
      setTime(current); setDuration(duration);
      s.current = current; s.duration = duration;
      // Don't overwrite saved progress with the zero sample sent while a resume seek loads.
      if (!s.resumed) {
        const target = Math.min(resumeAt, Math.max(0, duration - 2));
        if (source.controls && s.settings.resume && target > 5 && current < target - 3) { command("seek", target); return; }
        s.resumed = true;
      }
      s.callbacks.sample(current, duration);
      if (s.pausePending) { s.pausePending = false; s.callbacks.pause(); }
      const skip = s.skips.find((skip) => current >= skip.start && current < skip.end - 1 && ((skip.type === "op" && s.settings.autoSkipIntro) || (skip.type === "ed" && s.settings.autoSkipOutro)));
      if (skip && skip.end !== s.skipEnd && source.controls) { s.skipEnd = skip.end; command("seek", Math.min(skip.end, duration - 1)); }
      if (s.skipEnd && current < s.skipEnd - 20 && !skip) s.skipEnd = 0;
    };
    const onFs = () => frame.current?.contentWindow?.postMessage({ zenFullscreenState: !!document.fullscreenElement }, expectedOrigin);
    window.addEventListener("message", onMessage);
    document.addEventListener("fullscreenchange", onFs);
    const timer = source.controls ? setInterval(() => { command("getStatus"); command("getTime"); }, 2000) : undefined;
    return () => { window.removeEventListener("message", onMessage); document.removeEventListener("fullscreenchange", onFs); clearInterval(timer); };
  }, [playerUrl, source, command, frame, wrap, resumeAt]);

  useEffect(() => {
    if (!connected) return;
    command("updatePreferences", { skipIntro: settings.autoSkipIntro, skipOutro: settings.autoSkipOutro, autoPlay: settings.autoplay });
    command("volume", settings.volume); command(settings.muted ? "mute" : "unmute");
  }, [connected, command, settings.autoSkipIntro, settings.autoSkipOutro, settings.autoplay, settings.volume, settings.muted]);

  return { connected, time, duration, playing, playerError, command };
}
