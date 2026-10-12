"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { LogoMark } from "../Logo";
import RecoveryKey from "./RecoveryKey";
import Turnstile from "./Turnstile";

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-20 w-full max-w-sm px-4">
      <LogoMark size={36} />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted">{sub}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function ForgotForm({ captchaKey }: { captchaKey: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", recoveryKey: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  if (finished)
    return (
      <Shell title="Password updated" sub="You've been signed out on other devices.">
        <div className="panel mb-4 flex gap-3 rounded-xl p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> You can log in with your new password now.
        </div>
        <button onClick={() => router.push("/login")} className="btn btn-primary w-full">
          Log in
        </button>
      </Shell>
    );

  if (newKey)
    return (
      <Shell title="Save your new recovery key" sub="Your old key no longer works. Keep this one somewhere safe — it won't be shown again.">
        <RecoveryKey value={newKey} username={form.username} onDone={() => setFinished(true)} />
      </Shell>
    );

  return (
    <Shell title="Reset your password" sub="Use the recovery key you saved when you signed up. Lost it too? Ask a site admin to reset your password.">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (form.password !== form.confirm) return setError("Passwords don't match");
          setBusy(true);
          setError("");
          const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, captcha }) });
          const json = await res.json().catch(() => ({}));
          setBusy(false);
          if (captchaKey) setCaptchaNonce((n) => n + 1);
          if (res.ok) setNewKey(json.recoveryKey);
          else setError(json.error ?? "Something went wrong");
        }}
        className="space-y-4"
      >
        <input required value={form.username} onChange={set("username")} placeholder="Username" className="input text-sm" aria-label="Username" autoComplete="username" />
        <input
          required
          value={form.recoveryKey}
          onChange={set("recoveryKey")}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          className="input font-mono text-sm uppercase tracking-wider"
          aria-label="Recovery key"
          autoComplete="off"
          spellCheck={false}
        />
        <input type="password" required minLength={8} value={form.password} onChange={set("password")} placeholder="New password (8+ characters)" className="input text-sm" aria-label="New password" autoComplete="new-password" />
        <input type="password" required value={form.confirm} onChange={set("confirm")} placeholder="Confirm new password" className="input text-sm" aria-label="Confirm password" autoComplete="new-password" />
        {captchaKey && <Turnstile siteKey={captchaKey} action="forgot" onToken={setCaptcha} nonce={captchaNonce} />}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button disabled={busy || (!!captchaKey && !captcha)} className="btn btn-primary w-full">
          {busy && <LoaderCircle className="spin h-4 w-4" />} Reset password
        </button>
      </form>
      <Link href="/login" className="mt-6 inline-block text-sm text-muted hover:text-fg">
        Back to log in
      </Link>
    </Shell>
  );
}
