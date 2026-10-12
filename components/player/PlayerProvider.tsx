"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize2, PictureInPicture2, SkipForward, X } from "lucide-react";
import WatchClient from "../WatchClient";
import { PlayerContext, type PlayerSession } from "./context";

export { usePlayer, type PlayerSession, type WatchProps } from "./context";

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
 *  - float:   desktop, popped out into a corner window with the pop-out button
 *  - mini:    any other page, a small player you can keep watching while you browse
 * WatchClient itself is unchanged; it simply stays mounted.
 */
export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [popped, setPopped] = useState(false);
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

  const close = useCallback(() => {
    setSession(null);
    setPopped(false);
  }, []);

  const value = useMemo(() => ({ open, attach, height, stuck, popped, setPopped }), [open, attach, height, stuck, popped]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {session && <PlayerHost session={session} slot={slot} popped={popped} onUnpop={() => setPopped(false)} onHeight={setHeight} onStuck={setStuck} onClose={close} />}
    </PlayerContext.Provider>
  );
}

type Mode = "inline" | "stuck" | "float" | "mini";

function PlayerHost({
  session,
  slot,
  popped,
  onUnpop,
  onHeight,
  onStuck,
  onClose,
}: {
  session: PlayerSession;
  slot: HTMLElement | null;
  popped: boolean;
  onUnpop: () => void;
  onHeight: (h: number) => void;
  onStuck: (s: boolean) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const phone = useMedia(PHONE);
  const outer = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [pinned, setPinned] = useState(false);

  // Where the slot is (document coordinates). Scrolling only matters on phones, where the player
  // pins to the top; on desktop nothing runs while you scroll.
  useLayoutEffect(() => {
    if (!slot) {
      setPos(null);
      setPinned(false);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = slot.getBoundingClientRect();
      const next = { top: Math.round(r.top + window.scrollY), left: Math.round(r.left + window.scrollX), width: Math.round(r.width) };
      setPos((p) => (p && p.top === next.top && p.left === next.left && p.width === next.width ? p : next));
      if (phone) setPinned(r.top < 1);
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
    if (phone) window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      clearTimeout(settle);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [slot, phone]);

  const mode: Mode = !slot ? "mini" : phone ? (pinned ? "stuck" : "inline") : popped ? "float" : "inline";

  useEffect(() => onStuck(mode === "stuck"), [mode, onStuck]);

  // Tell the slot how much room the full player (video + control bar) needs.
  useEffect(() => {
    const el = outer.current;
    if (!el || mode !== "inline") return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, onHeight]);

  const compact = mode === "mini" || mode === "float";
  const desktopWindow = compact && !phone;
  const win = useFloatingWindow(desktopWindow);
  const progress = useEpisodeProgress(session);

  useEffect(() => {
    // Lets other floating buttons (scroll-to-top) get out of the way: "phone", or the corner on desktop.
    const value = !compact ? null : phone ? "phone" : win.corner;
    if (value) document.documentElement.setAttribute("data-floating-player", value);
    else document.documentElement.removeAttribute("data-floating-player");
    return () => document.documentElement.removeAttribute("data-floating-player");
  }, [compact, phone, win.corner]);

  const putBack = () => {
    onUnpop();
    slot?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const open = () => router.push(session.href);
  const next = session.props.nextEpisode ? `/watch/${session.props.anilistId}/${session.props.nextEpisode}` : null;

  const phoneWidth = 128;
  const outerStyle: React.CSSProperties =
    mode === "inline"
      ? pos
        ? { position: "absolute", top: pos.top, left: pos.left, width: pos.width }
        : { position: "absolute", top: 0, left: 0, width: 0, visibility: "hidden" }
      : mode === "stuck"
        ? { position: "fixed", top: 0, left: 0, right: 0, paddingTop: "env(safe-area-inset-top)", background: "#000" }
        : phone
          ? { position: "fixed", left: 8, right: 8, bottom: "calc(max(env(safe-area-inset-bottom), 0.4rem) + 4rem)" }
          : { position: "fixed", left: win.left, top: win.top, width: win.width, transform: win.transform, willChange: "transform" };

  // In every mode but inline only the video shows; the control bar under it is clipped away.
  const videoWidth = desktopWindow ? win.width : compact ? phoneWidth : undefined;
  const clipHeight = mode === "stuck" ? "calc(100vw * 9 / 16)" : compact ? `${Math.round((videoWidth! * 9) / 16)}px` : undefined;

  return (
    <div
      ref={outer}
      style={outerStyle}
      data-mode={mode}
      className={[
        // Inline it scrolls with the page, so it stays under the sticky navbar (z-40); detached it sits on top.
        mode === "inline" ? "z-30" : "z-[45]",
        mode === "inline" ? "" : "[&_.aspect-video]:!rounded-none",
        compact ? "overflow-hidden rounded-xl bg-panel shadow-xl shadow-black/50 ring-1 ring-white/10" : "",
        compact && phone ? "flex items-center gap-3 pr-1.5" : "",
        desktopWindow ? "group/pip animate-[pip-in_0.2s_ease-out]" : "",
        win.gliding ? "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" : "",
        win.active ? "select-none [&_iframe]:pointer-events-none" : "",
      ].join(" ")}
    >
      {/* Only clip when showing the video alone (mini, float, pinned); inline, the control bar's menus must be able to open past it. */}
      <div className={`relative shrink-0 ${clipHeight ? "overflow-hidden" : ""}`} style={{ width: videoWidth, height: clipHeight }}>
        <WatchClient {...session.props} />
        {/* On a phone the mini player is too small to use the embed's own controls: tap to go back. */}
        {compact && phone && <button onClick={open} className="absolute inset-0" aria-label={`Open ${session.title}`} />}
      </div>

      {compact && phone && (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button onClick={open} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[13px] font-medium">{session.title}</div>
            <div className="font-mono text-[11px] text-muted">Episode {session.props.episode}</div>
          </button>
          <IconButton onClick={open} label="Open the watch page" icon={Maximize2} />
          <IconButton onClick={onClose} label="Close the player" icon={X} />
        </div>
      )}

      {desktopWindow && (
        <>
          {/* Hover controls over the top of the video; the strip doubles as the drag handle. */}
          <div
            onPointerDown={win.startMove}
            onDoubleClick={mode === "float" ? putBack : open}
            className={`absolute inset-x-0 top-0 flex cursor-grab items-center gap-1 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 pb-6 pt-2 text-white transition-opacity duration-150 active:cursor-grabbing ${
              win.active || win.peek ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover/pip:opacity-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium drop-shadow">{session.title}</div>
              <div className="font-mono text-[11px] text-white/70">Episode {session.props.episode}</div>
            </div>
            {next && <IconButton onClick={() => router.push(next)} label={`Episode ${session.props.nextEpisode}`} icon={SkipForward} light />}
            {mode === "float" ? (
              <IconButton onClick={putBack} label="Put the player back" icon={PictureInPicture2} light />
            ) : (
              <>
                <IconButton onClick={open} label="Open the watch page" icon={Maximize2} light />
                <IconButton onClick={onClose} label="Close the player" icon={X} light />
              </>
            )}
          </div>

          {progress > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
              <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Resize from the corner that faces the middle of the screen. */}
          <div
            onPointerDown={win.startResize}
            className={`absolute h-5 w-5 opacity-0 transition-opacity group-hover/pip:opacity-100 ${win.corner[0] === "b" ? "top-0" : "bottom-0"} ${win.corner[1] === "r" ? "left-0" : "right-0"} ${
              win.corner === "br" || win.corner === "tl" ? "cursor-nwse-resize" : "cursor-nesw-resize"
            }`}
            aria-hidden
          >
            <span className={`absolute h-2.5 w-2.5 border-white/70 ${win.corner[0] === "b" ? "top-1 border-t-2" : "bottom-1 border-b-2"} ${win.corner[1] === "r" ? "left-1 border-l-2" : "right-1 border-r-2"}`} />
          </div>
        </>
      )}
    </div>
  );
}

function IconButton({ onClick, label, icon: Icon, light }: { onClick: () => void; label: string; icon: typeof X; light?: boolean }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`shrink-0 rounded-lg p-2 transition-colors ${light ? "text-white/85 hover:bg-white/15 hover:text-white" : "text-muted hover:bg-white/[0.06] hover:text-fg"}`}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** How far through the episode we are, from the player's own progress saves. */
function useEpisodeProgress(session: PlayerSession) {
  const [pct, setPct] = useState(0);
  const { anilistId, episode } = session.props;
  useEffect(() => {
    setPct(0);
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ anilistId: number; episode: number; pct: number }>).detail;
      if (d.anilistId === anilistId && d.episode === episode) setPct(d.pct);
    };
    window.addEventListener("anikumo:progress", on);
    return () => window.removeEventListener("anikumo:progress", on);
  }, [anilistId, episode]);
  return pct;
}

/** While the window is dragged or resized, nothing on the page can get selected. Returns the undo. */
function lockSelection() {
  const root = document.documentElement;
  window.getSelection()?.removeAllRanges();
  root.style.setProperty("user-select", "none");
  root.style.setProperty("-webkit-user-select", "none");
  const block = (ev: Event) => ev.preventDefault();
  document.addEventListener("selectstart", block);
  return () => {
    root.style.removeProperty("user-select");
    root.style.removeProperty("-webkit-user-select");
    document.removeEventListener("selectstart", block);
  };
}

type Corner = "tl" | "tr" | "bl" | "br";
const STORE = "ak_pip";
const MARGIN = 24;
const TOP_MARGIN = 80; // clears the navbar
const MIN_W = 280;

function readStored(): { corner: Corner; width: number } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "{}");
    return { corner: ["tl", "tr", "bl", "br"].includes(v.corner) ? v.corner : "br", width: Number(v.width) || 400 };
  } catch {
    return { corner: "br", width: 400 };
  }
}

/**
 * The desktop picture-in-picture window: drag it anywhere and it snaps to the nearest corner,
 * drag its inner corner to resize (16:9), and both are remembered.
 *
 * Dragging moves it with a transform (no layout work per mouse move), and the snap glides from
 * where you let go to the corner (the same transform trick in reverse).
 */
function useFloatingWindow(enabled: boolean) {
  const [{ corner, width }, setPlace] = useState(readStored);
  // Only ever rendered in the browser (the player mounts after hydration), so window is safe here.
  const [view, setView] = useState(() => ({ w: document.documentElement.clientWidth, h: window.innerHeight }));
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [gliding, setGliding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    const on = () => setView({ w: document.documentElement.clientWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Show the controls for a moment when the window appears, so people know they exist.
  useEffect(() => {
    if (!enabled) return;
    setPeek(true);
    const t = setTimeout(() => setPeek(false), 2000);
    return () => clearTimeout(t);
  }, [enabled]);

  const maxW = Math.max(MIN_W, Math.min(720, view.w * 0.6));
  const w = Math.round(Math.min(Math.max(width, MIN_W), maxW));
  const h = Math.round((w * 9) / 16);
  const homeOf = (c: Corner) => ({
    left: c[1] === "r" ? view.w - w - MARGIN : MARGIN,
    top: c[0] === "b" ? view.h - h - MARGIN : TOP_MARGIN,
  });
  const home = homeOf(corner);

  const save = (next: { corner: Corner; width: number }) => {
    setPlace(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
  };

  const startMove = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Stops the browser starting a text selection from this press.
    e.preventDefault();
    const unlock = lockSelection();
    const sx = e.clientX;
    const sy = e.clientY;
    // Keep the window on screen while it's dragged.
    const clampX = (dx: number) => Math.min(Math.max(dx, 8 - home.left), view.w - w - 8 - home.left);
    const clampY = (dy: number) => Math.min(Math.max(dy, 8 - home.top), view.h - h - 8 - home.top);
    let moved = false;
    let frame = 0;
    let last = { x: 0, y: 0 };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        setDragging(true);
        setGliding(false);
      }
      last = { x: clampX(dx), y: clampY(dy) };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          setOffset(last);
        });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      unlock();
      if (frame) cancelAnimationFrame(frame);
      if (!moved) return;
      setDragging(false);
      // Snap to whichever corner the middle of the window is closest to, gliding from the drop point.
      const dropLeft = home.left + last.x;
      const dropTop = home.top + last.y;
      const target: Corner = `${dropTop + h / 2 < view.h / 2 ? "t" : "b"}${dropLeft + w / 2 < view.w / 2 ? "l" : "r"}`;
      const to = homeOf(target);
      save({ corner: target, width: w });
      setOffset({ x: dropLeft - to.left, y: dropTop - to.top });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setGliding(true);
          setOffset(null);
        }),
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Stop the glide transition once it has finished so later layout changes don't animate.
  useEffect(() => {
    if (!gliding) return;
    const t = setTimeout(() => setGliding(false), 320);
    return () => clearTimeout(t);
  }, [gliding]);

  const startResize = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const unlock = lockSelection();
    const startX = e.clientX;
    const grow = corner[1] === "r" ? -1 : 1; // the handle is on the side facing the middle
    setResizing(true);
    let latest = w;
    let frame = 0;
    const move = (ev: PointerEvent) => {
      latest = Math.round(Math.min(Math.max(w + grow * (ev.clientX - startX), MIN_W), maxW));
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          setPlace((p) => ({ ...p, width: latest }));
        });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      unlock();
      if (frame) cancelAnimationFrame(frame);
      setResizing(false);
      save({ corner, width: latest });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return {
    corner,
    width: w,
    left: home.left,
    top: home.top,
    transform: offset ? `translate3d(${offset.x}px, ${offset.y}px, 0)` : undefined,
    gliding,
    active: dragging || resizing,
    peek,
    startMove,
    startResize,
  };
}
