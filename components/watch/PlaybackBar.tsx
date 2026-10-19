"use client";

import Link from "next/link";
import { CheckCheck, CircleCheck, CloudOff, LoaderCircle, LogIn } from "lucide-react";
import type { PlaybackSettings as Settings } from "@/lib/playback/settings";
import PlaybackSettings from "../PlaybackSettings";
import PlayerButton, { playerButtonClass } from "./PlayerButton";
import ProviderDropdown from "./ProviderDropdown";
import PopOutButton from "../player/PopOutButton";

type Props = {
  anilistId: number;
  enabled: boolean;
  controls: boolean;
  problem: boolean;
  loggedIn: boolean;
  recordHistory: boolean;
  watched: boolean;
  progressStatus: "idle" | "saving" | "saved" | "error";
  settings: Settings;
  settingsStatus: "saved" | "saving" | "error";
  updateSettings: (patch: Partial<Settings>) => void;
  onReload: () => void;
  onUseStandard?: () => void;
  onToggleWatched: () => void;
  onRetrySave: () => void;
};

// Paths from AniList's official mark: https://anilist.co/img/icons/icon.svg
function AniListLogo() {
  return (
    <svg viewBox="16 32 140 108" className="h-5 w-5" aria-hidden="true">
      <path fill="#02a9ff" fillRule="evenodd" d="M111.322,111.157 L111.322,41.029 C111.322,37.010 109.105,34.792 105.086,34.792 L91.365,34.792 C87.346,34.792 85.128,37.010 85.128,41.029 C85.128,41.029 85.128,56.337 85.128,74.333 C85.128,75.271 94.165,79.626 94.401,80.547 C101.286,107.449 95.897,128.980 89.370,129.985 C100.042,130.513 101.216,135.644 93.267,132.138 C94.483,117.784 99.228,117.812 112.869,131.610 C112.986,131.729 115.666,137.351 115.833,137.351 C131.170,137.351 148.050,137.351 148.050,137.351 C152.069,137.351 154.286,135.134 154.286,131.115 L154.286,117.394 C154.286,113.375 152.069,111.157 148.050,111.157 L111.322,111.157 Z" />
      <path fill="#fefefe" fillRule="evenodd" d="M54.365,34.792 L18.331,137.351 L46.327,137.351 L52.425,119.611 L82.915,119.611 L88.875,137.351 L116.732,137.351 L80.836,34.792 L54.365,34.792 ZM58.800,96.882 L67.531,68.470 L77.094,96.882 L58.800,96.882 Z" />
    </svg>
  );
}

export default function PlaybackBar(p: Props) {
  const progressLabel = p.progressStatus === "error" ? "Progress could not be saved. Retry saving" : p.watched ? "Mark episode as unwatched" : "Mark episode as watched";

  return (
    <div role="group" aria-label="Episode options" className="panel mt-3 flex items-center gap-2 rounded-xl p-1.5 sm:p-2">
      <ProviderDropdown disabled={!p.enabled} />

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        {p.loggedIn ? (!p.recordHistory ? null : 
          <PlayerButton label={progressLabel} aria-pressed={p.watched} disabled={p.progressStatus === "saving"} onClick={p.progressStatus === "error" ? p.onRetrySave : p.onToggleWatched} className={p.progressStatus === "error" ? "!text-amber-300" : p.watched ? "!text-success" : ""}>
            {p.progressStatus === "saving" ? <LoaderCircle className="h-[18px] w-[18px] animate-spin" /> : p.progressStatus === "error" ? <CloudOff className="h-[18px] w-[18px]" /> : p.watched ? <CheckCheck className="h-[18px] w-[18px]" /> : <CircleCheck className="h-[18px] w-[18px]" />}
          </PlayerButton>
        ) : <Link href="/login" aria-label="Log in to save watch progress" title="Log in to save watch progress" className={playerButtonClass}><LogIn className="h-[18px] w-[18px]" /></Link>}
        {p.enabled && <PlaybackSettings settings={p.settings} update={p.updateSettings} status={p.settingsStatus} controls={p.controls} loggedIn={p.loggedIn} problem={p.problem} onReload={p.onReload} onUseStandard={p.onUseStandard} />}
        <PopOutButton />
        <a href={`https://anilist.co/anime/${p.anilistId}`} target="_blank" rel="noopener noreferrer" aria-label="View anime on AniList (opens in a new tab)" title="View on AniList" className={playerButtonClass}>
          <AniListLogo />
        </a>
      </div>
      <span aria-live="polite" className="sr-only">{p.loggedIn && p.progressStatus !== "idle" ? p.progressStatus === "error" ? "Progress could not be saved" : p.progressStatus === "saving" ? "Saving progress" : "Progress saved" : ""}</span>
    </div>
  );
}
