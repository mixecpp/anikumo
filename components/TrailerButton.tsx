"use client";

import { useState } from "react";
import { Clapperboard } from "lucide-react";
import TrailerModal from "./TrailerModal";

export default function TrailerButton({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-ghost">
        <Clapperboard className="h-4 w-4" />
        Trailer
      </button>
      <TrailerModal trailer={open ? { id: youtubeId, title } : null} onClose={() => setOpen(false)} />
    </>
  );
}
