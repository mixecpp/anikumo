"use client";

import { PictureInPicture2 } from "lucide-react";
import PlayerButton from "../watch/PlayerButton";
import { usePlayerOptional } from "./context";

/** Pops the player out into a floating window (desktop) so you can scroll or browse while watching. */
export default function PopOutButton() {
  const player = usePlayerOptional();
  if (!player) return null;
  return (
    <PlayerButton label={player.popped ? "Put the player back" : "Pop out player"} aria-pressed={player.popped} onClick={() => player.setPopped(!player.popped)} className="hidden md:grid">
      <PictureInPicture2 className="h-[18px] w-[18px]" />
    </PlayerButton>
  );
}
