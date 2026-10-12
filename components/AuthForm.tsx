"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { LogoMark } from "./Logo";
import RecoveryKey from "./auth/RecoveryKey";
import Turnstile from "./auth/Turnstile";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    json = { error: res.status >= 500 ? "The server hit an error. Try again in a moment." : `Request failed (${res.status})` };
  }
  return { ok: res.ok, json };
}

export default function AuthForm({ mode, covers, captchaKey }: { mode: "login" | "register"; covers: string[]; captchaKey: string | null }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<{ key: string; username: string } | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const done = () => {
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (mode === "register" && data.password !== data.confirm) return setError("Passwords don't match");
    setBusy(true);
    setError("");
    const { ok, json } = await postJson(`/api/auth/${mode}`, { ...data, captcha });
    setBusy(false);
    // Captcha tokens are single-use: get a fresh one for the next try.
    if (captchaKey) setCaptchaNonce((n) => n + 1);
    if (!ok) return setError(String(json.error ?? "Something went wrong"));
    if (json.twoFactor && typeof json.ticket === "string") return setTicket(json.ticket);
    if (typeof json.recoveryKey === "string") return setRecovery({ key: json.recoveryKey, username: String(data.username) });
    done();
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, json } = await postJson("/api/auth/2fa", { ticket, code });
    setBusy(false);
    if (!ok) {
      if (String(json.error).includes("expired")) setTicket(null);
      return setError(String(json.error ?? "That code isn't valid"));
    }
    done();
  }

  const columns = [0, 1, 2].map((c) => covers.filter((_, i) => i % 3 === c));

  return (
    <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1200px] items-center gap-12 px-4 py-10 md:px-8 lg:grid-cols-2">
      <div className="relative hidden h-[620px] overflow-hidden rounded-3xl lg:block" aria-hidden>
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-3">
          {columns.map((col, c) => (
            <div key={c} className="flex flex-col gap-3" style={{ animation: `auth-scroll ${50 + c * 12}s linear infinite ${c % 2 ? "reverse" : ""}` }}>
              {[...col, ...col].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="aspect-[2/3] w-full rounded-xl object-cover opacity-60" />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/60" />
        <div className="absolute inset-x-8 bottom-8">
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            Track every episode.
            <br />
            Pick up exactly where you left off.
          </p>
          <p className="mt-2 text-sm text-muted">Synced history, lists and discussions across devices.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm">
        <LogoMark size={36} />
        <AnimatePresence mode="wait" initial={false}>
          {recovery ? (
            <motion.div key="recovery" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <h1 className="mt-6 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <KeyRound className="h-6 w-6 text-accent" /> Save your recovery key
              </h1>
              <p className="mt-1.5 text-sm text-muted">If you ever forget your password, this key is the only way to reset it yourself. It won&apos;t be shown again.</p>
              <div className="mt-8">
                <RecoveryKey value={recovery.key} username={recovery.username} onDone={done} doneLabel="Start watching" />
              </div>
            </motion.div>
          ) : ticket ? (
            <motion.div key="2fa" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <h1 className="mt-6 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <ShieldCheck className="h-6 w-6 text-success" /> Two-factor check
              </h1>
              <p className="mt-1.5 text-sm text-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
              <form onSubmit={submitCode} className="mt-8 space-y-4">
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="text"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={11}
                  className="input text-center font-mono text-lg tracking-[0.3em]"
                  aria-label="Authentication code"
                />
                {error && <ErrorBox text={error} />}
                <button disabled={busy || code.trim().length < 6} className="btn btn-primary w-full !py-2.5">
                  {busy && <LoaderCircle className="spin h-4 w-4" />} Verify
                </button>
                <button type="button" onClick={() => { setTicket(null); setCode(""); setError(""); }} className="flex items-center gap-1 text-sm text-muted hover:text-fg">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }}>
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1.5 text-sm text-muted">{mode === "login" ? "Log in to continue watching." : "It takes less than a minute."}</p>

              <form onSubmit={submit} className="mt-8 space-y-4">
                {mode === "register" ? (
                  <Field label="Username" name="username" autoComplete="username" pattern="[A-Za-z0-9_]{3,20}" title="3–20 letters, numbers or underscores" />
                ) : (
                  <Field label="Username" name="username" autoComplete="username" />
                )}
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
                    Password
                    {mode === "login" && (
                      <Link href="/forgot-password" className="font-normal text-muted hover:text-fg">
                        Forgot password?
                      </Link>
                    )}
                  </span>
                  <div className="relative">
                    <input
                      required
                      name="password"
                      type={show ? "text" : "password"}
                      minLength={mode === "register" ? 8 : undefined}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      className="input !pr-10 text-sm"
                    />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                {mode === "register" && <Field label="Confirm password" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} />}

                {captchaKey && <Turnstile siteKey={captchaKey} onToken={setCaptcha} nonce={captchaNonce} />}
                {error && <ErrorBox text={error} />}
                <button disabled={busy || (!!captchaKey && !captcha)} className="btn btn-primary w-full !py-2.5">
                  {busy && <LoaderCircle className="spin h-4 w-4" />}
                  {captchaKey && !captcha && !busy ? "Checking your browser…" : mode === "login" ? "Log in" : "Create account"}
                </button>
              </form>

              <p className="mt-8 text-sm text-muted">
                {mode === "login" ? "New here? " : "Already have an account? "}
                <Link href={`/${mode === "login" ? "register" : "login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-fg underline-offset-4 hover:underline">
                  {mode === "login" ? "Create an account" : "Log in"}
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {text}
    </motion.p>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input required className="input text-sm" {...props} />
    </label>
  );
}
