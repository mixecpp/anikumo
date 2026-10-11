"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListStatus } from "@/lib/list-shared";
import { toast, undoable } from "@/lib/toast";
import StatusMenu from "./StatusMenu";
import { usePrefs } from "../PrefsProvider";

/** Compact status control for cards and charts. */
export default function QuickStatus({ anilistId, title, coverImage, initial, align = "left" }: { anilistId: number; title: string; coverImage: string; initial: ListStatus | null; align?: "left" | "right" }) {
  const router = useRouter();
  const { loggedIn } = usePrefs();
  const [status, setStatus] = useState(initial);

  async function change(s: ListStatus) {
    if (!loggedIn) {
      toast("Log in to use your list", "info");
      return router.push("/login");
    }
    const prev = status;
    setStatus(s);
    const res = await fetch("/api/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anilistId, status: s, title, coverImage }) });
    if (!res.ok) {
      setStatus(prev);
      toast("Couldn't update your list", "error");
    }
  }

  function remove() {
    const prev = status;
    setStatus(null);
    undoable(`Removed ${title} from your list`, {
      commit: () => fetch(`/api/list?anilistId=${anilistId}`, { method: "DELETE" }),
      revert: () => setStatus(prev),
    });
  }

  return <StatusMenu status={status} onChange={change} onRemove={remove} size="sm" align={align} />;
}
