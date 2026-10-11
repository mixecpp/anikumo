"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";

export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy the link", "error");
    }
  }

  return (
    <button onClick={share} className="btn btn-ghost btn-icon" aria-label="Share" title="Share">
      {copied ? <Check className="h-4 w-4 text-success" /> : <Share2 className="h-4 w-4" />}
    </button>
  );
}
