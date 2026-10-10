"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (mode === "register" && data.password !== data.confirm) return setError("Passwords don't match");
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-2xl shadow-black/40">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login" ? "Log in to sync your progress and favorites." : "Track what you watch, pick up where you left off."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" ? (
            <>
              <Field label="Username" name="username" autoComplete="username" />
              <Field label="Email" name="email" type="email" autoComplete="email" />
              <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} />
              <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" minLength={8} />
            </>
          ) : (
            <>
              <Field label="Email or username" name="login" autoComplete="username" />
              <Field label="Password" name="password" type="password" autoComplete="current-password" />
            </>
          )}
          {error && <div className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent-2">{error}</div>}
          <button disabled={busy} className="btn btn-primary w-full !py-3">
            {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href="/register" className="text-accent hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input required className="input" {...props} />
    </label>
  );
}
