"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import ConfirmButton from "../account/ConfirmButton";

async function act(body: object) {
  const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Action failed", "error");
  return res.ok ? json : null;
}

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  return (
    <div className="flex gap-1.5">
      <button onClick={async () => (await act({ action: "resolve", reportId })) && (toast("Content removed"), router.refresh())} className="btn !py-1 !text-xs bg-red-500/90 text-[#fff] hover:bg-red-500">
        Remove content
      </button>
      <button onClick={async () => (await act({ action: "dismiss", reportId })) && (toast("Dismissed", "info"), router.refresh())} className="btn btn-ghost !py-1 !text-xs">
        Dismiss
      </button>
    </div>
  );
}

const DELETE_ACTION = { comment: "deleteComment", review: "deleteReview", post: "deletePost", post_comment: "deletePostComment", profile_comment: "deleteProfileComment" } as const;

export function DeleteContent({ kind, id }: { kind: keyof typeof DELETE_ACTION; id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      onConfirm={async () => (await act({ action: DELETE_ACTION[kind], id })) && (toast("Deleted", "info"), router.refresh())}
      label="Delete"
      confirmLabel="Confirm"
      className="text-xs text-muted hover:text-red-300"
    />
  );
}

export function ClearErrors() {
  const router = useRouter();
  return (
    <button onClick={async () => (await act({ action: "clearErrors" })) && router.refresh()} className="text-xs text-muted hover:text-fg">
      Clear log
    </button>
  );
}

const TAGS = [
  { id: "new", label: "New" },
  { id: "improved", label: "Improved" },
  { id: "fixed", label: "Fixed" },
] as const;

export function ChangelogForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", body: "", version: "", tag: "new", notify: false });
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await act({ action: "changelogCreate", ...form });
        setBusy(false);
        if (!r) return;
        toast(r.notified ? `Posted and sent to ${r.notified} users` : "Posted");
        setForm({ title: "", body: "", version: "", tag: "new", notify: false });
        router.refresh();
      }}
      className="panel space-y-3 rounded-xl p-5"
    >
      <div className="flex flex-wrap gap-2">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What changed?" maxLength={120} required className="input min-w-[220px] flex-1 !py-2 text-sm" aria-label="Title" />
        <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="Version (optional)" maxLength={20} className="input !w-40 !py-2 font-mono text-sm" aria-label="Version" />
      </div>
      <textarea
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        placeholder={"Details. One point per line — lines starting with - become bullets."}
        rows={5}
        maxLength={4000}
        className="input resize-y text-sm"
        aria-label="Details"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-white/[0.03] p-1">
            {TAGS.map((t) => (
              <button type="button" key={t.id} onClick={() => setForm({ ...form, tag: t.id })} className={`rounded-md px-3 py-1 text-xs transition-colors ${form.tag === t.id ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} className="accent-[var(--accent)]" />
            Notify everyone (bell)
          </label>
        </div>
        <button disabled={busy || !form.title.trim()} className="btn btn-primary !py-2">
          {busy && <LoaderCircle className="spin h-4 w-4" />} Post update
        </button>
      </div>
    </form>
  );
}

export function DeleteChangelog({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      onConfirm={async () => (await act({ action: "changelogDelete", id })) && router.refresh()}
      label="Delete"
      confirmLabel="Confirm"
      className="text-xs text-muted hover:text-red-300"
    />
  );
}
