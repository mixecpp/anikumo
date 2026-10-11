"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ListEntryDTO } from "@/lib/list-shared";
import { toast } from "@/lib/toast";

/** Shared state + persistence for one list entry, with optimistic updates. */
export function useEntry(anilistId: number, initial: ListEntryDTO | null, meta: { title: string; coverImage: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (patch: Partial<ListEntryDTO>) => {
      const prev = entry;
      setEntry((e) => ({ ...(e ?? defaults(anilistId, meta)), ...patch }) as ListEntryDTO);
      setSaving(true);
      const res = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId, title: meta.title, coverImage: meta.coverImage, ...patch }),
      });
      setSaving(false);
      if (res.status === 401) {
        setEntry(prev);
        toast("Log in to use your list", "info");
        router.push(`/login?next=/anime/${anilistId}`);
        return null;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEntry(prev);
        toast(json.error ?? "Couldn't save", "error");
        return null;
      }
      setEntry(json.entry);
      router.refresh();
      return json.entry as ListEntryDTO;
    },
    [anilistId, entry, meta, router],
  );

  const remove = useCallback(async () => {
    const prev = entry;
    setEntry(null);
    const res = await fetch(`/api/list?anilistId=${anilistId}`, { method: "DELETE" });
    if (!res.ok) {
      setEntry(prev);
      toast("Couldn't remove", "error");
      return false;
    }
    router.refresh();
    return prev;
  }, [anilistId, entry, router]);

  return { entry, setEntry, save, remove, saving };
}

function defaults(anilistId: number, meta: { title: string; coverImage: string }): ListEntryDTO {
  return {
    anilistId,
    status: "PLANNING",
    score: null,
    progress: 0,
    notes: "",
    tags: [],
    pinned: false,
    hiddenFromContinue: false,
    rewatching: false,
    rewatchCount: 0,
    rewatchEpisode: 0,
    startedAt: null,
    completedAt: null,
    title: meta.title,
    coverImage: meta.coverImage,
    updatedAt: new Date().toISOString(),
  };
}
