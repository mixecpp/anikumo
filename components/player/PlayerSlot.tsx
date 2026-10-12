"use client";

import { useEffect, useRef } from "react";
import { usePlayer, type WatchProps } from "./PlayerProvider";

/**
 * Where the player sits on the watch page. The player itself lives in the root layout
 * (see PlayerProvider) so it can keep playing when you leave; this just reserves its space
 * and tells it which episode to play.
 */
export default function PlayerSlot({ href, image, ...props }: WatchProps & { href: string; image: string }) {
  const { open, attach, height } = usePlayer();
  const ref = useRef<HTMLDivElement>(null);

  // Rebuild the session only when the episode (or viewer) changes, not on every render.
  const key = `${props.userId}:${props.anilistId}:${props.episode}`;
  const latest = useRef({ props, href, title: props.title, image });
  latest.current = { props, href, title: props.title, image };
  useEffect(() => {
    open(latest.current);
  }, [key, open]);

  useEffect(() => {
    attach(ref.current);
    return () => attach(null);
  }, [attach]);

  // Until the player has measured itself, reserve a 16:9 box plus room for the control bar.
  return (
    <div ref={ref} data-player-slot style={height ? { height } : undefined} className="w-full" aria-hidden>
      {!height && (
        <>
          <div className="aspect-video w-full rounded-2xl bg-black" />
          <div className="h-14" />
        </>
      )}
    </div>
  );
}
