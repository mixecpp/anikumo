"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { playbackUrl, type PlaybackSource } from "@/lib/playback/source";
import type { PlaybackSettings as Settings } from "@/lib/playback/settings";
import PlaybackBar from "./watch/PlaybackBar";
import { usePlaybackSettings } from "./usePlaybackSettings";
import { useWatchProgress } from "./useWatchProgress";
import { useEmbeddedPlayer } from "./useEmbeddedPlayer";

type Skip = { type: "op" | "ed"; start: number; end: number };
type Props = {
  anilistId: number; episode: number; idMal: number | null; title: string; coverImage: string;
  resumeAt: number; completed: boolean; hasNext: boolean; hasPrev: boolean; nextEpisode: number | null;
  userId: string | null; embedsEnabled: boolean; source: PlaybackSource; initialSettings: Settings;
  /** false: don't save this to the viewer's history (Watch Together guests). Can change without a reload. */
  recordHistory?: boolean;
};

export default function WatchClient(p: Props) {
  return <EpisodeWatch key={`${p.userId}:${p.anilistId}:${p.episode}`} {...p} />;
}

function EpisodeWatch(p: Props) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const preferences = usePlaybackSettings(p.initialSettings, p.userId);
  const { settings } = preferences;
  const [source, setSource] = useState(p.source);
  const [playerUrl, setPlayerUrl] = useState(() => playbackUrl(p.source, p.initialSettings, p.completed ? 0 : p.resumeAt));
  const [skips, setSkips] = useState<Skip[]>([]);
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [initializing, setInitializing] = useState(true);
  const audioRef = useRef(p.initialSettings.audioTrack);
  const [resumeAt, setResumeAt] = useState(p.completed ? 0 : p.resumeAt);
  const progress = useWatchProgress({ userId: p.userId, anilistId: p.anilistId, episode: p.episode, title: p.title, coverImage: p.coverImage, completed: p.completed, record: p.recordHistory !== false });
  const latestProgress = progress.latest;
  const saveProgress = progress.save;
  const endedRef = useRef(false);
  const onEnded = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (p.userId) void progress.markWatched();
    if (settings.autoplayNext && p.nextEpisode) setNextIn(5);
  };
  const player = useEmbeddedPlayer(frame, wrap, source, playerUrl, settings, resumeAt, skips, {
    sample: progress.sample, pause: () => { void progress.save(); }, ended: onEnded,
  });

  // Guest audio preferences load after hydration; account preferences are already in initial HTML.
  useEffect(() => {
    if (audioRef.current === settings.audioTrack) return;
    audioRef.current = settings.audioTrack;
    const position = latestProgress.current?.progressSeconds ?? (p.completed ? 0 : p.resumeAt);
    setResumeAt(position);
    setPlayerUrl(playbackUrl(source, settings, position));
    endedRef.current = false;
  }, [settings, source, p.completed, p.resumeAt, latestProgress]);

  useEffect(() => {
    setInitializing(true);
    const timer = setTimeout(() => setInitializing(false), 25000);
    return () => clearTimeout(timer);
  }, [playerUrl]);

  useEffect(() => {
    if (!p.idMal) return;
    const controller = new AbortController();
    fetch(`/api/skip?malId=${p.idMal}&ep=${p.episode}`, { signal: controller.signal })
      .then((r) => r.json()).then((j) => { if (!controller.signal.aborted) setSkips(j.skips ?? []); }).catch(() => {});
    return () => controller.abort();
  }, [p.idMal, p.episode]);

  useEffect(() => {
    if (nextIn === null) return;
    if (!settings.autoplayNext) { setNextIn(null); return; }
    if (nextIn === 0) { void saveProgress(true); router.push(`/watch/${p.anilistId}/${p.nextEpisode}`); return; }
    const timer = setTimeout(() => setNextIn(nextIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [nextIn, p.anilistId, p.nextEpisode, router, saveProgress, settings.autoplayNext]);

  const command = player.command;
  const toggle = useCallback(() => command(player.playing ? "pause" : "play"), [command, player.playing]);
  const seek = useCallback((seconds: number) => command("seek", Math.max(0, Math.min(player.duration, seconds))), [command, player.duration]);
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrap.current?.requestFullscreen();
    } catch {}
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || target?.isContentEditable || target?.closest('[role="dialog"]') || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target?.tagName)) return;
      if (!source.controls || !player.connected) return;
      if (e.key === " " || e.key.toLowerCase() === "k") { e.preventDefault(); toggle(); }
      else if (["ArrowLeft", "j", "ArrowRight", "l"].includes(e.key)) {
        e.preventDefault(); seek(player.time + (["ArrowLeft", "j"].includes(e.key) ? -10 : 10));
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault(); void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source.controls, player.connected, player.time, seek, toggle, toggleFullscreen]);

  function useStandardEmbed() {
    void progress.save();
    const fallback: PlaybackSource = { url: source.fallbackUrl, fallbackUrl: source.fallbackUrl, protocol: "aniweeb", controls: false };
    setSource(fallback); setPlayerUrl(playbackUrl(fallback, settings, 0));
  }

  function retryPlayer() {
    const position = progress.latest.current?.progressSeconds ?? resumeAt;
    void progress.save();
    setResumeAt(position);
    const url = new URL(playbackUrl(source, settings, position));
    url.searchParams.set("reload", String(Date.now()));
    setPlayerUrl(url.href);
  }

  return (
    <div>
      {p.embedsEnabled ? (
        <div ref={wrap} className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          {/*
            Cage the player so its ad scripts can't reach the user: no allow-popups means no
            popunders, and no allow-top-navigation means it can't redirect the tab. allow-scripts
            runs the player, and allow-same-origin keeps its origin real so our postMessage
            controls (resume, skip, progress) still work. This is enforced by the browser, so it
            ships with the page — users need no extension.
          */}
          <iframe ref={frame} key={playerUrl} src={playerUrl} title={`${p.title} - Episode ${p.episode}`} width="100%" height="480" frameBorder="0" className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock" allowFullScreen />
        </div>
      ) : <div className="grid aspect-video w-full place-items-center rounded-2xl border border-line bg-surface p-6"><p className="text-sm text-muted">Playback is currently disabled.</p></div>}
      <PlaybackBar
        anilistId={p.anilistId}
        enabled={p.embedsEnabled}
        controls={source.controls}
        problem={p.embedsEnabled && source.controls && ((!initializing && !player.connected) || player.playerError)}
        loggedIn={!!p.userId}
        recordHistory={p.recordHistory !== false}
        watched={progress.watched}
        progressStatus={progress.saved}
        settings={settings}
        settingsStatus={preferences.status}
        updateSettings={preferences.update}
        onReload={retryPlayer}
        onUseStandard={source.controls ? useStandardEmbed : undefined}
        onToggleWatched={() => { void progress.toggleWatched(); }}
        onRetrySave={() => { void progress.save(); }}
      />
    </div>
  );
}
