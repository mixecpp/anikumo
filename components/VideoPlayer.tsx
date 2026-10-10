"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Skip = { type: "op" | "ed"; start: number; end: number };

type Props = {
  src: string;
  subtitles: { label: string; lang: string; url: string }[];
  resumeAt: number;
  skips: Skip[];
  hasNext: boolean;
  onProgress: (current: number, duration: number, final?: boolean) => void;
  onEnded: () => void;
  onNext: () => void;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function pref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function savePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export default function VideoPlayer({ src, subtitles, resumeAt, skips, hasNext, onProgress, onEnded, onNext }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [subsOn, setSubsOn] = useState(true);
  const [showUi, setShowUi] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [autoSkip, setAutoSkip] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverTime, setHoverTime] = useState<{ x: number; t: number } | null>(null);
  const [resumed, setResumed] = useState<number | null>(null);

  useEffect(() => {
    setVolume(pref("aw_volume", 1));
    setMuted(pref("aw_muted", false));
    setAutoSkip(pref("aw_autoskip", false));
    setAutoplayNext(pref("aw_autoplay", true));
    setSubsOn(pref("aw_subs", true));
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (video.current) video.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    for (const t of Array.from(v.textTracks)) t.mode = subsOn ? "showing" : "hidden";
  }, [subsOn, src]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seek = useCallback((t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrap.current?.requestFullscreen();
  }, []);

  const poke = useCallback(() => {
    setShowUi(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!video.current?.paused) setShowUi(false);
    }, 2800);
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const v = video.current;
      if (!v) return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seek(v.currentTime + (e.key === "l" ? 10 : 5));
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seek(v.currentTime - (e.key === "j" ? 10 : 5));
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((x) => Math.min(1, x + 0.1));
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((x) => Math.max(0, x - 0.1));
          break;
        case "m":
          setMuted((x) => !x);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "c":
          setSubsOn((x) => !x);
          break;
        case "n":
          if (hasNext) onNext();
          break;
        case "s": {
          const active = skips.find((s) => v.currentTime >= s.start && v.currentTime < s.end - 1);
          if (active) seek(active.end);
          break;
        }
        default:
          if (/^[0-9]$/.test(e.key) && v.duration) seek((Number(e.key) / 10) * v.duration);
          else return;
      }
      poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, toggleFullscreen, poke, hasNext, onNext, skips]);

  // Periodic progress save
  useEffect(() => {
    const t = setInterval(() => {
      const v = video.current;
      if (v && !v.paused && v.duration) onProgress(v.currentTime, v.duration);
    }, 10_000);
    return () => clearInterval(t);
  }, [onProgress]);

  // Save on unmount / tab close
  useEffect(() => {
    const flush = () => {
      const v = video.current;
      if (v && v.duration && v.currentTime > 5) onProgress(v.currentTime, v.duration, true);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [onProgress]);

  // Next-episode countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onNext();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, onNext]);

  const activeSkip = skips.find((s) => time >= s.start && time < s.end - 1);

  useEffect(() => {
    if (autoSkip && activeSkip) seek(activeSkip.end);
  }, [autoSkip, activeSkip, seek]);

  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;
  const nearEnd = hasNext && duration > 0 && duration - time < 90 && !activeSkip;

  return (
    <div
      ref={wrap}
      onMouseMove={poke}
      onMouseLeave={() => !video.current?.paused && setShowUi(false)}
      className={`group relative aspect-video w-full select-none overflow-hidden bg-black ${fullscreen ? "" : "rounded-2xl"} ${showUi ? "" : "cursor-none"}`}
    >
      <video
        ref={video}
        src={src}
        className="h-full w-full"
        playsInline
        autoPlay
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setShowUi(true);
          const v = video.current;
          if (v?.duration) onProgress(v.currentTime, v.duration);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          setError(null);
          if (resumeAt > 10 && resumeAt < v.duration - 30) {
            v.currentTime = resumeAt;
            setResumed(resumeAt);
            setTimeout(() => setResumed(null), 4000);
          }
        }}
        onEnded={() => {
          onEnded();
          if (hasNext && autoplayNext) setCountdown(5);
        }}
        onError={() =>
          setError(
            "This file can't be played in the browser. Most often it's HEVC/x265 video or an unsupported audio codec. Try an H.264 MP4 or MKV.",
          )
        }
      >
        {subtitles.map((s, i) => (
          <track key={s.url} kind="subtitles" src={s.url} srcLang={s.lang} label={s.label} default={i === 0} />
        ))}
      </video>

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/85 p-8 text-center">
          <div className="max-w-md">
            <div className="text-3xl">⚠</div>
            <p className="mt-3 text-sm text-fg/90">{error}</p>
          </div>
        </div>
      )}

      {resumed !== null && (
        <div className="fade-in absolute left-4 top-4 rounded-lg bg-black/75 px-3 py-2 text-sm backdrop-blur">
          Resumed from {fmt(resumed)} ·{" "}
          <button className="text-accent hover:underline" onClick={() => seek(0)}>
            Start over
          </button>
        </div>
      )}

      {activeSkip && !autoSkip && (
        <button
          onClick={() => seek(activeSkip.end)}
          className="fade-in absolute bottom-24 right-5 rounded-lg border border-white/30 bg-black/70 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white hover:text-black"
        >
          Skip {activeSkip.type === "op" ? "Opening" : "Ending"} ⏭
        </button>
      )}

      {nearEnd && countdown === null && (
        <button
          onClick={onNext}
          className="fade-in absolute bottom-24 right-5 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg transition hover:bg-accent hover:text-white"
        >
          Next episode ⏭
        </button>
      )}

      {countdown !== null && (
        <div className="absolute inset-0 grid place-items-center bg-black/80">
          <div className="text-center">
            <div className="text-sm text-muted">Next episode in</div>
            <div className="font-[family-name:var(--font-display)] text-6xl font-extrabold">{countdown}</div>
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={onNext} className="btn btn-primary">
                Play now
              </button>
              <button onClick={() => setCountdown(null)} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!playing && !error && countdown === null && (
        <button onClick={toggle} className="absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full bg-accent/90 shadow-2xl shadow-accent/40 transition hover:scale-105" aria-label="Play">
          <svg className="ml-1 h-9 w-9 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-16 transition-opacity duration-300 ${showUi || !playing ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div
          className="group/seek relative mb-2 h-4 cursor-pointer"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - r.left;
            setHoverTime({ x, t: (x / r.width) * duration });
          }}
          onMouseLeave={() => setHoverTime(null)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * duration);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20 transition-all group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufPct}%` }} />
            {skips.map((s) =>
              duration ? (
                <div
                  key={s.type + s.start}
                  className="absolute inset-y-0 bg-amber-400/60"
                  style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%` }}
                />
              ) : null,
            )}
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-accent transition group-hover/seek:scale-100"
            style={{ left: `${pct}%` }}
          />
          {hoverTime && (
            <div className="absolute -top-8 -translate-x-1/2 rounded bg-black/90 px-2 py-1 text-xs" style={{ left: hoverTime.x }}>
              {fmt(hoverTime.t)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm sm:gap-3">
          <IconBtn onClick={toggle} label={playing ? "Pause (k)" : "Play (k)"}>
            {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
          </IconBtn>
          <IconBtn onClick={() => seek(time - 10)} label="Back 10s (j)">
            <path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
          </IconBtn>
          <IconBtn onClick={() => seek(time + 10)} label="Forward 10s (l)">
            <path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" />
          </IconBtn>
          {hasNext && (
            <IconBtn onClick={onNext} label="Next episode (n)">
              <path d="M6 5v14l9-7zM16 5h2v14h-2z" />
            </IconBtn>
          )}
          <div className="group/vol hidden items-center sm:flex">
            <IconBtn onClick={() => setMuted((m) => { savePref("aw_muted", !m); return !m; })} label="Mute (m)">
              {muted || volume === 0 ? (
                <path d="M4 9v6h4l5 5V4L8 9H4zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z" />
              ) : (
                <path d="M4 9v6h4l5 5V4L8 9H4zm12.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
              )}
            </IconBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(v === 0);
                savePref("aw_volume", v);
                savePref("aw_muted", v === 0);
              }}
              className="w-0 accent-[var(--accent)] opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100"
            />
          </div>
          <span className="ml-1 tabular-nums text-fg/80">
            {fmt(time)} <span className="text-muted">/ {fmt(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {subtitles.length > 0 && (
              <button
                onClick={() => setSubsOn((s) => { savePref("aw_subs", !s); return !s; })}
                className={`rounded px-1.5 py-0.5 text-xs font-bold ring-1 transition ${subsOn ? "bg-white text-black ring-white" : "text-fg/80 ring-white/50"}`}
                title="Subtitles (c)"
              >
                CC
              </button>
            )}
            <div className="relative">
              <IconBtn onClick={() => setMenu((m) => !m)} label="Settings">
                <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L14.9 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.4 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.9h4l.4-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM12.9 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
              </IconBtn>
              {menu && (
                <div className="absolute bottom-12 right-0 w-56 rounded-xl border border-line bg-surface/95 p-3 text-sm shadow-2xl backdrop-blur">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Speed</div>
                  <div className="mb-3 grid grid-cols-3 gap-1">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`rounded-md py-1 text-xs ${speed === s ? "bg-accent text-white" : "bg-white/5 hover:bg-white/10"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                  <Toggle label="Auto-skip intro/outro" value={autoSkip} onChange={(v) => { setAutoSkip(v); savePref("aw_autoskip", v); }} />
                  <Toggle label="Autoplay next episode" value={autoplayNext} onChange={(v) => { setAutoplayNext(v); savePref("aw_autoplay", v); }} />
                </div>
              )}
            </div>
            <IconBtn onClick={toggleFullscreen} label="Fullscreen (f)">
              {fullscreen ? (
                <path d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z" />
              ) : (
                <path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z" />
              )}
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="grid h-9 w-9 place-items-center rounded-full text-fg/90 transition hover:bg-white/10 hover:text-white">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        {children}
      </svg>
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-accent" : "bg-white/20"}`}
        role="switch"
        aria-checked={value}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
