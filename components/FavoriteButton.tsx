"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  async function toggle() {
    if (!loggedIn) return router.push("/login");
    setBusy(true);
    setFav((f) => !f);
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilistId, title, coverImage }),
    });
    if (res.ok) setFav((await res.json()).favorited);
    else setFav((f) => !f);
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy} className={`btn ${fav ? "btn-ghost !text-accent" : "btn-ghost"}`}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
      </svg>
      {fav ? "Favorited" : "Favorite"}
    </button>
  );
}
