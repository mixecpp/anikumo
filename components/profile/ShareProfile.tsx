"use client";

import { Share2 } from "lucide-react";
import { toast } from "@/lib/toast";

/** Share sheet on phones, copy link on desktop. */
export default function ShareProfile({ username, className = "" }: { username: string; className?: string }) {
  async function share() {
    const url = `${location.origin}/u/${username}`;
    try {
      if (navigator.share && matchMedia("(hover: none)").matches) await navigator.share({ url, title: `${username} on AniKumo` });
      else {
        await navigator.clipboard.writeText(url);
        toast("Profile link copied", "info");
      }
    } catch {}
  }
  return (
    <button onClick={share} className={`btn btn-ghost !px-3 ${className}`} aria-label="Share profile" title="Share profile">
      <Share2 className="h-4 w-4" />
    </button>
  );
}
