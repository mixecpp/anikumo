"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { toast } from "@/lib/toast";
import { usePrefs } from "./PrefsProvider";

/** `compact`: a small pill for lists (and no page refresh, so the list doesn't reshuffle). */
export default function FollowButton({ username, initial, compact = false }: { username: string; initial: boolean; compact?: boolean }) {
  const router = useRouter();
  const { loggedIn } = usePrefs();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) return router.push(`/login?next=/u/${username}`);
    setBusy(true);
    setFollowing((f) => !f);
    const res = await fetch("/api/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setFollowing((f) => !f);
      return toast(json.error ?? "Couldn't update", "error");
    }
    setFollowing(json.following);
    if (!compact) router.refresh();
  }

  if (compact)
    return (
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${following ? "border border-white/10 text-muted hover:text-fg" : "bg-fg text-bg hover:opacity-90"}`}
      >
        {following ? "Following" : "Follow"}
      </button>
    );

  return (
    <button onClick={toggle} disabled={busy} className={`btn ${following ? "btn-ghost" : "btn-primary"}`}>
      {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
