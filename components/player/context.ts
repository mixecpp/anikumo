"use client";

import { createContext, useContext } from "react";
import type WatchClient from "../WatchClient";

export type WatchProps = React.ComponentProps<typeof WatchClient>;
export type PlayerSession = { props: WatchProps; href: string; title: string; image: string };

export type PlayerCtx = {
  /** Called by the watch page's slot: start (or keep) playing this episode. */
  open: (s: PlayerSession) => void;
  /** The watch page's placeholder element, or null when the page is left. */
  attach: (el: HTMLElement | null) => void;
  /** Height the player needs in the page (video + its control bar). */
  height: number;
  /** Phones: is the player pinned to the top of the screen right now? */
  stuck: boolean;
  /** Desktop: has the player been popped out into a floating window? */
  popped: boolean;
  setPopped: (v: boolean) => void;
};

// Lives in its own module so the player's own controls can use it without importing
// PlayerProvider (which imports the player — that would be a circular import).
export const PlayerContext = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer needs <PlayerProvider>");
  return ctx;
}

/** Same as usePlayer, but null outside the provider (for components that also render elsewhere). */
export function usePlayerOptional() {
  return useContext(PlayerContext);
}
