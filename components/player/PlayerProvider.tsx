"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import WatchClient from "../WatchClient";

export type WatchProps = React.ComponentProps<typeof WatchClient>;
export type PlayerSession = { props: WatchProps; href: string; title: string; image: string };

type Ctx = {
  /** Called by the watch page's slot: start (or keep) playing this episode. */
  open: (s: PlayerSession) => void;
  /** The watch page's placeholder element, or null when the page is left. */
  attach: (el: HTMLElement | null) => void;
  /** Height the player needs in the page (video + its control bar). */
  height: number;
  /** Phones: is the player pinned to the top of the screen right now? */
  stuck: boolean;
};
const PlayerContext = createContext<Ctx | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer needs <PlayerProvider>");
  return ctx;
}

const sessionKey = (s: PlayerSession) => `${s.props.userId}:${s.props.anilistId}:${s.props.episode}`;
const PHONE = "(max-width: 767px)";

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/**
 * Keeps one video player alive across the whole site, YouTube-style.
 *
 * The episode player is an embedded iframe, and an iframe reloads whenever it is removed from
 * the page or moved to another parent. So instead of living inside the watch page, the player
 * lives here, in the root layout, and is only ever repositioned:
 *  - inline:  laid over the watch page's slot (scrolls with the page)
 *  - stuck:   phones, pinned to the top once you scroll past it, so comments scroll underneath
 *  - float:   desktop, a corner window once you scroll down the watch page
 *  - mini:    any other page, a small player you can keep watching while you browse
 * WatchClient itself is unchanged; it simply stays mounted.
 */
export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  const [stuck, setStuck] = useState(false);
  const detachTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback((s: PlayerSession) => {
    // Same episode as what's already playing: keep the running player as it is.
    setSession((prev) => (prev && sessionKey(prev) === sessionKey(s) ? prev : s));
  }, []);

  const attach = useCallback((el: HTMLElement | null) => {
    if (detachTimer.current) clearTimeout(detachTimer.current);
    if (el) setSlot(el);
    // Going from one episode straight to the next mounts a new slot right after the old one
    // unmounts; wait a moment so the player doesn't flash into mini mode in between.
    else detachTimer.current = setTimeout(() => setSlot(null), 250);
  }, []);

  const value = useMemo(() => ({ open, attach, height, stuck }), [open, attach, height, stuck]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {session && <PlayerHost session={session} slot={slot} onHeight={setHeight} onStuck={setStuck} onClose={() => setSession(null)} />}
    </PlayerContext.Provider>
  );
}

type Mode = "inline" | "stuck" | "float" | "mini";

function PlayerHost({ session, slot, onHeight, onStuck, onClose }: { session: PlayerSession; slot: HTMLElement | null; onHeight: (h: number) => void; onStuck: (s: boolean) => void; onClose: () => void }) {
  const router = useRouter();
  const phone = useMedia(PHONE);
  const outer = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [scrolledPast, setScrolledPast] = useState(false);
  const [floatDismissed, setFloatDismissed] = useState(false);

  // Track where the slot is (document coordinates) and whether it has scrolled out of view.
  useLayoutEffect(() => {
    if (!slot) {
      setPos(null);
      setScrolledPast(false);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = slot.getBoundingClientRect();
      const next = { top: Math.round(r.top + window.scrollY), left: Math.round(r.left + window.scrollX), width: Math.round(r.width) };
      setPos((p) => (p && p.top === next.top && p.left === next.left && p.width === next.width ? p : next));
      // Phones pin as soon as the top of the video reaches the top; desktop floats once most of it is gone.
      setScrolledPast(phone ? r.top < 1 : r.bottom < Math.min(r.height * 0.35, 220));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    // The page fades/slides in (app/template.tsx); measure again once that has settled.
    const settle = setTimeout(schedule, 400);
    const ro = new ResizeObserver(schedule);
    ro.observe(slot);
    ro.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      clearTimeout(settle);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [slot, phone]);

  // A new episode shouldn't inherit "I closed the floating player".
  useEffect(() => setFloatDismissed(false), [session]);

  const mode: Mode = !slot ? "mini" : scrolledPast ? (phone ? "stuck" : floatDismissed ? "inline" : "float") : "inline";

  useEffect(() => onStuck(mode === "stuck"), [mode, onStuck]);
  useEffect(() => {
    // Lets other floating buttons (scroll-to-top) move out of the way.
    document.documentElement.toggleAttribute("data-floating-player", mode === "mini" || mode === "float");
    return () => document.documentElement.removeAttribute("data-floating-player");
  }, [mode]);

  // Tell the slot how much room the full player (video + control bar) needs.
  useEffect(() => {
    const el = outer.current;
    if (!el || mode !== "inline") return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, onHeight]);

  const compact = mode === "mini" || mode === "float";
  const videoWidth = compact ? (phone ? 128 : 360) : null;

  const outerStyle: React.CSSProperties =
    mode === "inline"
      ? pos
        ? { position: "absolute", top: pos.top, left: pos.left, width: pos.width }
        : { position: "absolute", top: 0, left: 0, width: 0, visibility: "hidden" }
      : mode === "stuck"
        ? { position: "fixed", top: 0, left: 0, right: 0, paddingTop: "env(safe-area-inset-top)", background: "#000" }
        : phone
          ? { position: "fixed", left: 8, right: 8, bottom: "calc(max(env(safe-area-inset-bottom), 0.4rem) + 4rem)" }
          : { position: "fixed", right: 24, bottom: 24, width: videoWidth! };

  // In every mode but inline only the video shows; the control bar under it is clipped away.
  const clipHeight = mode === "stuck" ? "calc(100vw * 9 / 16)" : compact ? `${Math.round((videoWidth! * 9) / 16)}px` : undefined;

  return (
    <div
      ref={outer}
      style={outerStyle}
      data-mode={mode}
      className={`z-[45] ${mode === "inline" ? "" : "[&_.aspect-video]:!rounded-none"} ${
        compact ? `overflow-hidden rounded-xl border border-white/10 bg-panel/95 shadow-2xl shadow-black/60 backdrop-blur-xl ${phone ? "flex items-center gap-3 pr-1.5" : "flex flex-col"}` : ""
      }`}
    >
      <div className="relative shrink-0 overflow-hidden" style={{ width: videoWidth ?? undefined, height: clipHeight }}>
        <WatchClient {...session.props} />
        {/* On a phone the mini player is too small to use the embed's own controls: tap to go back. */}
        {compact && phone && <button onClick={() => router.push(session.href)} className="absolute inset-0" aria-label={`Open ${session.title}`} />}
      </div>
      {compact && (
        <div className={`flex min-w-0 items-center gap-1 ${phone ? "flex-1" : "-order-1 border-b border-white/[0.06] px-3 py-2"}`}>
          <button onClick={() => (mode === "float" ? slot?.scrollIntoView({ behavior: "smooth", block: "center" }) : router.push(session.href))} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[13px] font-medium">{session.title}</div>
            <div className="font-mono text-[11px] text-muted">Episode {session.props.episode}</div>
          </button>
          <button
            onClick={() => (mode === "float" ? slot?.scrollIntoView({ behavior: "smooth", block: "center" }) : router.push(session.href))}
            className="rounded-lg p-2 text-muted hover:bg-white/[0.06] hover:text-fg"
            aria-label={mode === "float" ? "Back to the player" : "Open the watch page"}
            title={mode === "float" ? "Back to the player" : "Open"}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => (mode === "float" ? setFloatDismissed(true) : onClose())}
            className="rounded-lg p-2 text-muted hover:bg-white/[0.06] hover:text-fg"
            aria-label={mode === "float" ? "Stop floating" : "Close the player"}
            title={mode === "float" ? "Stop floating" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
