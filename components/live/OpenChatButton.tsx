"use client";

import { MessagesSquare } from "lucide-react";
import { useLiveOptional } from "./LiveProvider";

/** Opens the floating live chat (used on pages that talk about it). */
export default function OpenChatButton({ className = "btn btn-primary", children }: { className?: string; children?: React.ReactNode }) {
  const live = useLiveOptional();
  return (
    <button type="button" onClick={() => live?.setOpen(true)} className={className}>
      {children ?? (
        <>
          <MessagesSquare className="h-4 w-4" /> Join the chat
        </>
      )}
    </button>
  );
}

/** "12 online", kept live by the chat poll. */
export function OnlineNow({ initial }: { initial: number }) {
  const live = useLiveOptional();
  const n = live?.online || initial;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {n.toLocaleString()} online now
    </span>
  );
}
