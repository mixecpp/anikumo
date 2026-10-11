"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronRight, LoaderCircle, RotateCw, Settings as SettingsIcon, X } from "lucide-react";
import type { PlaybackSettings as Settings } from "@/lib/playback/settings";
import PlayerButton from "./watch/PlayerButton";

type Props = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  controls: boolean;
  status: "saved" | "saving" | "error";
  loggedIn: boolean;
  problem: boolean;
  onReload: () => void;
  onUseStandard?: () => void;
};

const toggles = [
  ["resume", "Resume playback"],
  ["autoSkipIntro", "Skip intro"],
  ["autoSkipOutro", "Skip outro"],
  ["autoplayNext", "Play next episode"],
  ["autoplay", "Autoplay video"],
] as const;

export default function PlaybackSettings({ settings, update, controls, status, loggedIn, problem, onReload, onUseStandard }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const muted = settings.muted || settings.volume === 0;

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0" onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <PlayerButton
        ref={trigger}
        label="Playback settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`relative ${open ? "bg-white/[0.07] !text-fg" : ""}`}
      >
        <SettingsIcon className="h-[18px] w-[18px]" />
        {(status === "error" || problem) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />}
      </PlayerButton>
      {open && (
        <div ref={panel} id={id} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1} className="glass-strong absolute -right-10 top-full z-30 mt-3 max-h-[70dvh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-3 text-sm outline-none sm:bottom-full sm:right-0 sm:top-auto sm:mb-3 sm:mt-0">
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2">
            <h2 id={`${id}-title`} className="text-sm font-semibold tracking-tight">Playback settings</h2>
            <button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="rounded-md p-1 text-muted transition-colors hover:bg-white/[0.07] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70" aria-label="Close playback settings">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs text-fg/85">Audio</span>
            <div className="flex rounded-lg bg-white/[0.04] p-0.5" role="group" aria-label="Audio track">
              {([ ["sub", "Original"], ["dub", "English"] ] as const).map(([track, label]) => (
                <button key={track} type="button" aria-pressed={settings.audioTrack === track} onClick={() => update({ audioTrack: track })} className={`rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${settings.audioTrack === track ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-3 px-1 text-[10px] text-muted">Audio availability varies by episode.</p>

          <div className="border-y border-white/[0.06] py-1.5">
            {toggles.map(([key, label]) => (
              <button key={key} type="button" role="switch" aria-checked={settings[key]} disabled={!controls && key !== "autoplayNext"} onClick={() => update({ [key]: !settings[key] })} className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-2 text-xs text-fg/85 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent">
                <span>{label}</span>
                <span aria-hidden="true" className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${settings[key] ? "bg-accent" : "bg-white/15"}`}>
                  <span className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full transition-transform ${settings[key] ? "translate-x-3.5 bg-bg" : "bg-fg/80"}`} />
                </span>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3 py-3 text-xs">
            <span className="text-fg/85">Volume</span>
            <input aria-label="Volume" aria-valuetext={`${Math.round((muted ? 0 : settings.volume) * 100)} percent`} type="range" min="0" max="1" step="0.05" disabled={!controls} value={muted ? 0 : settings.volume} onChange={(event) => {
              const volume = Number(event.target.value);
              update({ volume, muted: volume === 0 });
            }} className="h-1 w-full min-w-0 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35" />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">{Math.round((muted ? 0 : settings.volume) * 100)}%</span>
          </label>

          <div className="border-t border-white/[0.06] pt-2">
            {problem && <p role="status" className="mb-2 px-1 text-xs leading-relaxed text-amber-300">Playback is taking longer than expected. Try reloading or opening the standard player.</p>}
            {!controls && <p className="mb-2 px-1 text-xs leading-relaxed text-muted">Use the video controls for playback, volume, and skipping.</p>}
            <button type="button" onClick={() => { setOpen(false); onReload(); trigger.current?.focus(); }} className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-xs text-muted transition-colors hover:bg-white/[0.04] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
              <RotateCw className="h-3.5 w-3.5" /> Reload player
            </button>
            {problem && onUseStandard && <button type="button" onClick={() => { setOpen(false); onUseStandard(); trigger.current?.focus(); }} className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-xs text-muted transition-colors hover:bg-white/[0.04] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
              Open standard player <ChevronRight className="h-3.5 w-3.5" />
            </button>}
          </div>

          <div aria-live="polite" className="mt-2 flex items-center gap-1.5 border-t border-white/[0.06] px-1 pt-3 font-mono text-[10px] text-muted">
            {status === "error" ? (
              <button type="button" onClick={() => update({})} className="flex items-center gap-1.5 text-amber-300 hover:underline"><RotateCw className="h-3 w-3" /> Retry saving settings</button>
            ) : <>{status === "saving" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}{status === "saving" ? "Saving settings" : loggedIn ? "Saved to your account" : "Saved on this device"}</>}
          </div>
        </div>
      )}
    </div>
  );
}
