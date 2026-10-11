"use client";

import { useState } from "react";
import { Clock, Pencil, Repeat } from "lucide-react";
import type { ListEntryDTO } from "@/lib/list-shared";
import { toast, undoable } from "@/lib/toast";
import { useEntry } from "./useEntry";
import StatusMenu from "./StatusMenu";
import ScorePicker from "./ScorePicker";
import EntryEditor from "./EntryEditor";
import CustomListsMenu from "./CustomListsMenu";
import { usePrefs } from "../PrefsProvider";

type Finish = { minutes: number; days: number | null; doneBy: string | null } | null;

function fmtMinutes(m: number) {
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
}

/** "Your list" controls on an anime page. */
export default function EntryPanel({ anilistId, title, coverImage, total, initial, finish }: { anilistId: number; title: string; coverImage: string; total: number | null; initial: ListEntryDTO | null; finish: Finish }) {
  const { loggedIn } = usePrefs();
  const { entry, setEntry, save } = useEntry(anilistId, initial, { title, coverImage });
  const [editing, setEditing] = useState(false);

  function remove() {
    const prev = entry;
    setEntry(null);
    undoable(`Removed ${title} from your list`, {
      commit: () => fetch(`/api/list?anilistId=${anilistId}`, { method: "DELETE" }),
      revert: () => setEntry(prev),
    });
  }

  async function bump() {
    if (!entry) return;
    const next = entry.progress + 1;
    const done = total !== null && next >= total;
    const saved = await save({ progress: next, ...(done ? { status: "COMPLETED" as const } : entry.status === "PLANNING" ? { status: "WATCHING" as const } : {}) });
    if (saved && done && entry.status !== "COMPLETED") toast(`Completed ${title} 🎉`);
  }

  return (
    <div className="panel space-y-4 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <StatusMenu status={entry?.status ?? null} onChange={(status) => save({ status })} onRemove={remove} />
        {loggedIn && <CustomListsMenu anilistId={anilistId} title={title} coverImage={coverImage} />}
        {entry && (
          <button onClick={() => setEditing(true)} className="btn btn-ghost btn-icon ml-auto" aria-label="Edit list entry" title="Edit details">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {entry && (
        <>
          <div>
            <div className="label mb-1.5">Your score</div>
            <ScorePicker value={entry.score} onChange={(score) => save({ score })} />
          </div>
          <div>
            <div className="label mb-1.5">Progress</div>
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className="tabular-nums">
                {entry.progress}/{total ?? "?"}
              </span>
              {entry.status !== "COMPLETED" && (total === null || entry.progress < total) && (
                <button onClick={bump} className="press rounded bg-white/[0.07] px-2 py-0.5 text-xs text-muted hover:bg-white/[0.12] hover:text-fg">
                  +1 ep
                </button>
              )}
            </div>
            {total ? (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div className={`h-full transition-all ${entry.status === "COMPLETED" ? "bg-success" : "bg-accent"}`} style={{ width: `${Math.min(100, (entry.progress / total) * 100)}%` }} />
              </div>
            ) : null}
          </div>
          {entry.rewatching && (
            <div className="flex items-center gap-2 text-xs text-accent">
              <Repeat className="h-3.5 w-3.5" /> Rewatching · Ep {entry.rewatchEpisode}/{total ?? "?"}
            </div>
          )}
          {finish && entry.status !== "COMPLETED" && (
            <div className="flex items-start gap-2 text-xs text-muted">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {total && total - entry.progress} episodes left ≈ {fmtMinutes(finish.minutes)}
                {finish.doneBy && ` · at your pace, done by ${new Date(finish.doneBy).toLocaleDateString(undefined, { weekday: finish.days && finish.days < 7 ? "long" : undefined, month: "short", day: "numeric" })}`}
              </span>
            </div>
          )}
          {entry.notes && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs italic text-muted">“{entry.notes}”</p>}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.tags.map((t) => (
                <span key={t} className="chip !py-0 !text-[10px]">#{t}</span>
              ))}
            </div>
          )}
        </>
      )}

      <EntryEditor open={editing} onClose={() => setEditing(false)} entry={entry} title={title} coverImage={coverImage} total={total} onSave={(patch) => save(patch)} onRemove={remove} />
    </div>
  );
}
