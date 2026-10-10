"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const COLORS = ["#e11d48", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

async function patch(body: object) {
  const res = await fetch("/api/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, ...(await res.json()) };
}

export default function ProfileSettings({ avatarColor }: { avatarColor: string }) {
  const router = useRouter();
  const [color, setColor] = useState(avatarColor);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pickColor(c: string) {
    setColor(c);
    await patch({ avatarColor: c });
    router.refresh();
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));
    const r = await patch({ currentPassword: d.current, newPassword: d.next });
    setMsg({ ok: r.ok, text: r.ok ? "Password updated" : r.error });
    if (r.ok) form.reset();
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and all your history? This can't be undone.")) return;
    await fetch("/api/account", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold">Avatar colour</h3>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => pickColor(c)}
              className={`h-8 w-8 rounded-full transition ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-surface" : "hover:scale-110"}`}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
      </div>

      <form onSubmit={changePassword} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold">Change password</h3>
        <input name="current" type="password" placeholder="Current password" required className="input text-sm" autoComplete="current-password" />
        <input name="next" type="password" placeholder="New password (8+ chars)" required minLength={8} className="input text-sm" autoComplete="new-password" />
        {msg && <div className={`text-sm ${msg.ok ? "text-emerald-400" : "text-accent"}`}>{msg.text}</div>}
        <button className="btn btn-ghost w-full">Update password</button>
      </form>

      <button onClick={deleteAccount} className="w-full text-sm text-muted hover:text-accent">
        Delete account
      </button>
    </div>
  );
}
