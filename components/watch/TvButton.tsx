"use client";

import { useEffect, useRef, useState } from "react";
import { Airplay, Cast } from "lucide-react";
import PlayerButton from "./PlayerButton";
import PlayerPopover from "./PlayerPopover";

type Device = "ios" | "mac" | "android" | "pc";

const DEVICES: { id: Device; label: string }[] = [
  { id: "ios", label: "iPhone / iPad" },
  { id: "mac", label: "Mac" },
  { id: "android", label: "Android" },
  { id: "pc", label: "Computer" },
];

// The video comes from an embedded player we don't control, so its own AirPlay/Cast button can't
// be switched on from here. Screen mirroring works with every player, so that's what this explains.
const STEPS: Record<Device, string[]> = {
  ios: [
    "Open Control Center: swipe down from the top-right corner.",
    "Tap Screen Mirroring and pick your Apple TV or AirPlay TV.",
    "Start the episode and turn your phone sideways.",
  ],
  mac: [
    "Click Control Center in the menu bar.",
    "Click Screen Mirroring and pick your Apple TV or AirPlay TV.",
    "Start the episode and make the video fullscreen.",
  ],
  android: [
    "Swipe down from the top of the screen twice.",
    "Tap Cast, Smart View or Screen cast (the name depends on your phone) and pick your TV.",
    "Start the episode and turn your phone sideways.",
  ],
  pc: [
    "Chrome: open the ⋮ menu and choose Cast. Edge: open the … menu, then More tools, then Cast media to device.",
    "Under Sources, choose Cast tab, then pick your TV.",
    "On Windows you can also press Windows + K to mirror the whole screen.",
  ],
};

function detect(): Device {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Macintosh/.test(ua)) return "mac";
  if (/Android/.test(ua)) return "android";
  return "pc";
}

/** "Watch on TV": AirPlay on Apple devices, casting everywhere else. */
export default function TvButton() {
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<Device>("pc");
  const [apple, setApple] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = detect();
    setDevice(d);
    setApple(d === "ios" || d === "mac");
  }, []);

  const Icon = apple ? Airplay : Cast;
  const label = apple ? "AirPlay to a TV" : "Watch on a TV";

  return (
    <div className="relative shrink-0">
      <PlayerButton ref={trigger} label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={open ? "bg-white/[0.07] !text-fg" : ""}>
        <Icon className="h-[18px] w-[18px]" />
      </PlayerButton>
      <PlayerPopover open={open} onClose={() => setOpen(false)} anchor={trigger} title="Watch on a TV" width={300} height={320}>
        <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Your device">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={device === d.id}
              onClick={() => setDevice(d.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 md:py-1 ${device === d.id ? "bg-accent/15 text-accent" : "bg-white/[0.04] text-muted hover:text-fg"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <ol className="space-y-2.5 text-[13px] leading-snug text-fg/85 md:text-xs">
          {STEPS[device].map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[10px] text-muted">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[11px] leading-snug text-muted">Your phone or computer and the TV need to be on the same Wi‑Fi.</p>
      </PlayerPopover>
    </div>
  );
}
