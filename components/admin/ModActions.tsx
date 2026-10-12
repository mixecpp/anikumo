"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, LoaderCircle, MoreHorizontal, Trash2, VolumeX, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { FloatingPortal, useDismiss, useFloating } from "../ui/Floating";

export async function staffAction(body: object) {
  const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "That didn't work", "error");
  return res.ok ? json : null;
}

type Item = { label: string; danger?: boolean; reason?: string; run: (reason: string) => Promise<unknown> };

/** A small button with a floating menu; items with `reason` ask for one before running. */
function ActionMenu({ trigger, label, items, align = "right" }: { trigger: React.ReactNode; label: string; items: Item[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<Item | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const floating = useFloating(anchor, open, { align, height: 220, width: 232 });
  const close = () => {
    setOpen(false);
    setAsking(null);
    setReason("");
  };
  useDismiss(open, close, [anchor, panel]);

  async function run(item: Item, why: string) {
    setBusy(true);
    await item.run(why);
    setBusy(false);
    close();
  }

  return (
    <>
      <button ref={anchor} onClick={() => (open ? close() : setOpen(true))} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs transition-colors ${open ? "bg-white/[0.08] text-fg" : "text-muted hover:bg-white/[0.06] hover:text-fg"}`}>
        {trigger}
      </button>
      <FloatingPortal>
        <AnimatePresence>
          {open && floating && (
            <motion.div ref={panel} role="menu" style={floating} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }} className="glass-strong rounded-xl p-1">
              {asking ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (reason.trim()) run(asking, reason.trim());
                  }}
                  className="space-y-2 p-1.5"
                >
                  <div className="text-xs font-medium">{asking.label}</div>
                  <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} rows={3} placeholder={asking.reason} className="input resize-none !py-1.5 text-xs" aria-label="Reason" />
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setAsking(null)} className="rounded-md px-2 py-1 text-xs text-muted hover:text-fg">
                      Back
                    </button>
                    <button disabled={busy || !reason.trim()} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-[#fff] disabled:opacity-40 ${asking.danger ? "bg-red-500/90 hover:bg-red-500" : "bg-accent/90 text-bg hover:bg-accent"}`}>
                      {busy && <LoaderCircle className="spin h-3 w-3" />} Confirm
                    </button>
                  </div>
                </form>
              ) : (
                items.map((it) => (
                  <button
                    key={it.label}
                    role="menuitem"
                    disabled={busy}
                    onClick={() => (it.reason ? setAsking(it) : run(it, ""))}
                    className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${it.danger ? "text-red-300 hover:bg-red-500/10" : "text-fg/85 hover:bg-white/[0.07]"}`}
                  >
                    {it.label}
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}

/**
 * Moderation controls for one person. Moderators can mute for up to a week and ask an admin to
 * ban them or clear their profile; admins do those directly.
 */
export function ModActions({ userId, username, muted, banned, isAdmin, hasAvatar = true, onDone }: { userId: string; username: string; muted: boolean; banned: boolean; isAdmin: boolean; hasAvatar?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const act = async (body: object, done: string) => {
    if (await staffAction({ userId, ...body })) {
      toast(done);
      if (onDone) onDone();
      else router.refresh();
    }
  };
  const mutes: [number, string][] = [
    [60, "1 hour"],
    [60 * 24, "1 day"],
    [60 * 24 * 7, "7 days"],
    ...(isAdmin ? ([[60 * 24 * 30, "30 days"]] as [number, string][]) : []),
  ];

  const more: Item[] = isAdmin
    ? [
        banned
          ? { label: "Unban", run: () => act({ action: "unban" }, `${username} unbanned`) }
          : { label: "Ban…", danger: true, reason: "Why? (they'll see this)", run: (r) => act({ action: "ban", reason: r }, `${username} banned`) },
        { label: "Clear bio & banner", run: () => act({ action: "clearProfile" }, "Bio and banner cleared") },
        ...(hasAvatar ? [{ label: "Remove picture", run: () => act({ action: "removeAvatar" }, "Picture removed") }] : []),
      ]
    : [
        ...(banned ? [] : [{ label: "Request a ban…", danger: true, reason: "Why should they be banned?", run: (r: string) => act({ action: "request", kind: "ban", reason: r }, "Sent to the admins") }]),
        { label: "Request bio & banner removal…", reason: "What's wrong with it?", run: (r) => act({ action: "request", kind: "clearProfile", reason: r }, "Sent to the admins") },
        ...(hasAvatar ? [{ label: "Request picture removal…", reason: "What's wrong with it?", run: (r: string) => act({ action: "request", kind: "removeAvatar", reason: r }, "Sent to the admins") }] : []),
      ];

  return (
    <div className="flex items-center gap-0.5">
      {muted ? (
        <button onClick={() => act({ action: "mute", minutes: 0 }, `${username} unmuted`)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-amber-200 hover:bg-white/[0.06]">
          <VolumeX className="h-3.5 w-3.5" /> Unmute
        </button>
      ) : (
        <ActionMenu
          label={`Mute ${username}`}
          trigger={
            <>
              <VolumeX className="h-3.5 w-3.5" /> Mute <ChevronDown className="h-3 w-3" />
            </>
          }
          items={mutes.map(([minutes, label]) => ({ label: `For ${label}`, run: () => act({ action: "mute", minutes }, `${username} muted for ${label}`) }))}
        />
      )}
      <ActionMenu label={`More actions for ${username}`} trigger={<MoreHorizontal className="h-4 w-4" />} items={more} />
    </div>
  );
}

/** Remove / dismiss for a report. */
export function ReportButtons({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: "resolve" | "dismiss") => {
    setBusy(action);
    if (await staffAction({ action, reportId })) {
      toast(action === "resolve" ? "Removed" : "Dismissed", "info");
      router.refresh();
    }
    setBusy(null);
  };
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => run("resolve")} disabled={!!busy} className="flex h-7 items-center gap-1.5 rounded-lg bg-red-500/15 px-2.5 text-xs text-red-200 transition-colors hover:bg-red-500/25">
        {busy === "resolve" ? <LoaderCircle className="spin h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
      </button>
      <button onClick={() => run("dismiss")} disabled={!!busy} className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted transition-colors hover:bg-white/[0.06] hover:text-fg">
        {busy === "dismiss" ? <LoaderCircle className="spin h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} Looks fine
      </button>
    </div>
  );
}

/** Delete one piece of content (with a quick confirm). */
export function RemoveButton({ kind, id }: { kind: "comment" | "review" | "post" | "post_comment" | "profile_comment"; id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const action = { comment: "deleteComment", review: "deleteReview", post: "deletePost", post_comment: "deletePostComment", profile_comment: "deleteProfileComment" }[kind];
  if (confirming)
    return (
      <span className="flex items-center gap-0.5">
        <button onClick={async () => (await staffAction({ action, id })) && (toast("Removed", "info"), router.refresh())} className="flex h-7 items-center rounded-lg bg-red-500/15 px-2 text-xs text-red-200 hover:bg-red-500/25">
          Remove
        </button>
        <button onClick={() => setConfirming(false)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-fg" aria-label="Cancel">
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  return (
    <button onClick={() => setConfirming(true)} className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-red-500/10 hover:text-red-300" aria-label="Remove" title="Remove">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** Approve / decline a moderator's request (admins). */
export function RequestButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: "approveRequest" | "denyRequest") => {
    setBusy(action);
    if (await staffAction({ action, requestId })) {
      toast(action === "approveRequest" ? "Approved — done" : "Declined", "info");
      router.refresh();
    }
    setBusy(null);
  };
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => run("approveRequest")} disabled={!!busy} className="flex h-7 items-center gap-1.5 rounded-lg bg-accent/90 px-2.5 text-xs font-medium text-bg transition-colors hover:bg-accent">
        {busy === "approveRequest" && <LoaderCircle className="spin h-3.5 w-3.5" />} Approve
      </button>
      <button onClick={() => run("denyRequest")} disabled={!!busy} className="flex h-7 items-center rounded-lg px-2.5 text-xs text-muted transition-colors hover:bg-white/[0.06] hover:text-fg">
        Decline
      </button>
    </div>
  );
}
