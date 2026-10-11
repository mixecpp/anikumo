"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "@/lib/toast";

export default function FavoriteButton({
  anilistId,
  title,
  coverImage,
  initial,
  loggedIn,
}: {
  anilistId: number;
  title: string;
  coverImage: string;
  initial: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(0);

  async function toggle() {
    if (!loggedIn) {
      toast("Log in to save favorites", "info");
      return router.push(`/login?next=/anime/${anilistId}`);
    }
    setBusy(true);
    const optimistic = !fav;
    setFav(optimistic);
    if (optimistic) setPop((p) => p + 1);
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilistId, title, coverImage }),
    });
    if (res.ok) {
      const { favorited } = await res.json();
      setFav(favorited);
      toast(favorited ? "Added to favorites" : "Removed from favorites", favorited ? "success" : "info");
    } else {
      setFav(!optimistic);
      toast("Couldn't update favorites", "error");
    }
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy} aria-pressed={fav} className="btn btn-ghost">
      <Heart key={pop} className={`h-4 w-4 transition-colors ${fav ? "heart-pop fill-accent text-accent" : ""}`} />
      {fav ? "Favorited" : "Favorite"}
    </button>
  );
}
