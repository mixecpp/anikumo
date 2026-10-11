"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, ChevronDown, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { Avatar } from "../UserMenu";
import ConfirmButton from "../account/ConfirmButton";

type Row = {
  id: string;
  username: string;
  avatarColor: string;
  createdAt: string;
  isAdmin: boolean;
  bannedAt: string | null;
  banReason: string;
  totpEnabled: boolean;
  profilePublic: boolean;
  lastSeenAt: string | null;
  counts: { listEntries: number; comments: number; reviews: number };
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "admins", label: "Admins" },
  { id: "banned", label: "Banned" },
] as const;

async function act(body: object) {
  const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Action failed", "error");
  return res.ok ? json : null;
}

function ago(iso: string | null) {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 600) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export default function UsersTable({ meId }: { meId: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; pageSize: number; users: Row[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users?${new URLSearchParams({ q, filter, page: String(page) })}`);
    if (res.ok) setData(await res.json());
  }, [q, filter, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder="Search usernames" className="input !py-2 !pl-9 text-sm" aria-label="Search users" />
        </label>
        <div className="flex gap-1 rounded-lg bg-white/[0.03] p-1">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => (setFilter(f.id), setPage(0))} className={`rounded-md px-3 py-1 text-sm transition-colors ${filter === f.id ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-muted">{data ? `${data.total.toLocaleString()} users` : ""}</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
        {!data ? (
          <div className="flex justify-center p-10">
            <LoaderCircle className="spin h-5 w-5 text-muted" />
          </div>
        ) : data.users.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">No users match.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {data.users.map((u) => (
              <li key={u.id}>
                <button onClick={() => setOpen(open === u.id ? null : u.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]" aria-expanded={open === u.id}>
                  <Avatar name={u.username} color={u.avatarColor} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="truncate font-medium">{u.username}</span>
                      {u.isAdmin && <span className="chip !py-0 !text-[10px]"><ShieldCheck className="h-3 w-3" /> admin</span>}
                      {u.bannedAt && <span className="chip !border-red-400/30 !py-0 !text-[10px] text-red-300"><Ban className="h-3 w-3" /> banned</span>}
                      {u.id === meId && <span className="text-xs text-muted">(you)</span>}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">
                      joined {new Date(u.createdAt).toLocaleDateString()} · seen {ago(u.lastSeenAt)}
                    </div>
                  </div>
                  <div className="hidden gap-5 font-mono text-xs text-muted sm:flex">
                    <span title="List entries">{u.counts.listEntries} list</span>
                    <span title="Comments">{u.counts.comments} cmt</span>
                    <span title="Reviews">{u.counts.reviews} rev</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open === u.id ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open === u.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <UserActions user={u} self={u.id === meId} onChange={load} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn btn-ghost !py-1.5">
            Previous
          </button>
          <span className="font-mono text-xs text-muted">
            {page + 1} / {pages}
          </span>
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="btn btn-ghost !py-1.5">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function UserActions({ user, self, onChange }: { user: Row; self: boolean; onChange: () => void }) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const run = async (body: object, msg: string) => {
    if (await act({ userId: user.id, ...body })) {
      toast(msg);
      onChange();
      return true;
    }
    return false;
  };

  return (
    <div className="grid gap-4 border-t border-white/[0.04] bg-white/[0.015] px-4 py-4 text-sm md:grid-cols-2">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {user.profilePublic && (
            <Link href={`/u/${user.username}`} className="btn btn-ghost !py-1.5 !text-xs">
              View profile
            </Link>
          )}
          <button onClick={() => run({ action: "signOut" }, `Signed ${user.username} out everywhere`)} className="btn btn-ghost !py-1.5 !text-xs">
            Sign out everywhere
          </button>
          {!self && (
            <button onClick={() => run({ action: "setAdmin", value: !user.isAdmin }, user.isAdmin ? "Admin removed" : `${user.username} is now an admin`)} className="btn btn-ghost !py-1.5 !text-xs">
              {user.isAdmin ? "Remove admin" : "Make admin"}
            </button>
          )}
        </div>
        <form onSubmit={async (e) => (e.preventDefault(), (await run({ action: "resetPassword", password }, "Password reset")) && setPassword(""))} className="flex gap-2">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (8+)" minLength={8} className="input !py-1.5 text-xs" aria-label="New password" autoComplete="new-password" />
          <button disabled={password.length < 8} className="btn btn-ghost !py-1.5 !text-xs">
            Reset password
          </button>
        </form>
        <div className="font-mono text-[11px] text-muted">
          2FA {user.totpEnabled ? "on" : "off"} · profile {user.profilePublic ? "public" : "private"}
        </div>
      </div>

      {!self && !user.isAdmin && (
        <div className="space-y-3">
          {user.bannedAt ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-red-300">
                Banned {new Date(user.bannedAt).toLocaleDateString()}
                {user.banReason && `: ${user.banReason}`}
              </span>
              <button onClick={() => run({ action: "unban" }, `${user.username} unbanned`)} className="btn btn-ghost !py-1.5 !text-xs">
                Unban
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => (e.preventDefault(), run({ action: "ban", reason }, `${user.username} banned`))} className="flex gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ban reason (shown to them)" maxLength={300} className="input !py-1.5 text-xs" aria-label="Ban reason" />
              <button className="btn !py-1.5 !text-xs bg-red-500/15 text-red-300 hover:bg-red-500/25">Ban</button>
            </form>
          )}
          <div className="flex gap-2">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Type ${user.username} to delete`} className="input !py-1.5 text-xs" aria-label="Confirm username to delete" />
            {confirm === user.username ? (
              <ConfirmButton onConfirm={() => run({ action: "deleteUser", confirm }, "User deleted")} label="Delete" confirmLabel="Really delete?" className="btn !py-1.5 !text-xs bg-red-500/90 text-[#fff] hover:bg-red-500" />
            ) : (
              <button disabled className="btn btn-ghost !py-1.5 !text-xs">
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
