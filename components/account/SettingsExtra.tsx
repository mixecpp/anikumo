"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Download, KeyRound, LoaderCircle, Monitor, Moon, ShieldCheck, Smartphone, Sun, Upload } from "lucide-react";
import { ACCENTS, DEFAULT_SHORTCUTS, SHORTCUT_LABELS, type Prefs, type ShortcutAction } from "@/lib/prefs-shared";
import { LOCALE_NAMES } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import Select from "../Select";
import { Toggle } from "../list/EntryEditor";
import { Row, SettingsCard } from "./SettingsCard";
import RecoveryKey from "../auth/RecoveryKey";

async function patchPrefs(patch: Partial<Prefs>) {
  const res = await fetch("/api/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  if (!res.ok) toast("Couldn't save preference", "error");
  return res.ok;
}

async function patchAccount(body: object) {
  const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Couldn't save", "error");
  return res.ok;
}

/* ───────── Preferences ───────── */

export function PreferencesCard({ prefs }: { prefs: Prefs }) {
  const router = useRouter();
  const [p, setP] = useState(prefs);
  const set = async (patch: Partial<Prefs>) => {
    setP((x) => ({ ...x, ...patch }));
    if (await patchPrefs(patch)) router.refresh();
  };
  const themes = [
    { v: "dark" as const, label: "Dark", icon: Moon },
    { v: "light" as const, label: "Light", icon: Sun },
    { v: "system" as const, label: "System", icon: Monitor },
  ];
  return (
    <SettingsCard id="preferences" title="Preferences" description="How AniKumo looks and reads. Saved to your account.">
      <div className="divide-y divide-white/[0.06]">
        <Row title="Theme">
          <div className="flex rounded-xl bg-white/[0.05] p-1">
            {themes.map(({ v, label, icon: Icon }) => (
              <button key={v} onClick={() => set({ theme: v })} aria-pressed={p.theme === v} className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${p.theme === v ? "text-fg" : "text-muted hover:text-fg"}`}>
                {p.theme === v && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-lg bg-white/[0.1]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </Row>
        <Row title="Accent colour">
          <div className="flex flex-wrap gap-1.5">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => set({ accent: c })} aria-label={`Accent ${c}`} aria-pressed={p.accent === c} className="relative h-6 w-6 rounded-full transition-transform hover:scale-110" style={{ background: c }}>
                {p.accent === c && <motion.span layoutId="accent-ring" className="absolute -inset-[3px] rounded-full ring-2 ring-white" />}
              </button>
            ))}
          </div>
        </Row>
        <Row title="Anime titles" hint="Which title to show everywhere">
          <Select label="Title language" value={p.titleLang} onChange={(v) => set({ titleLang: v as Prefs["titleLang"] })} options={[{ value: "english", label: "English" }, { value: "romaji", label: "Romaji" }, { value: "native", label: "Native (日本語)" }]} className="w-44" align="right" />
        </Row>
        <Row title="Interface language">
          <Select label="Interface language" value={p.locale} onChange={(v) => set({ locale: v as Prefs["locale"] })} options={Object.entries(LOCALE_NAMES).map(([value, label]) => ({ value, label }))} className="w-44" align="right" />
        </Row>
        <div id="content" className="scroll-mt-24" />
        <Row title="Hide ecchi titles" hint="Removes them from browse, search picks and recommendations">
          <Toggle on={p.hideEcchi} onChange={(v) => set({ hideEcchi: v })} label="Hide ecchi titles" />
        </Row>
        <Row title="Blur ecchi covers" hint="Covers are blurred until you hover">
          <Toggle on={p.blurEcchi} onChange={(v) => set({ blurEcchi: v })} label="Blur ecchi covers" />
        </Row>
      </div>
    </SettingsCard>
  );
}

/* ───────── Public profile ───────── */

export function ProfileVisibilityCard({ username, bio: initialBio, profilePublic }: { username: string; bio: string; profilePublic: boolean }) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  const [pub, setPub] = useState(profilePublic);
  return (
    <SettingsCard
      id="visibility"
      title="Public profile"
      description="Off by default. When on, others can see your profile, follow you and find you on the leaderboard."
      footer={
        <>
          <span className="font-mono text-[11px] text-muted">/u/{username}</span>
          <button onClick={async () => (await patchAccount({ bio })) && (toast("Bio saved"), router.refresh())} disabled={bio === initialBio} className="btn btn-primary">
            Save bio
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Row title="Make my profile public" hint="Shows your stats, favorites, list and public custom lists">
          <Toggle
            on={pub}
            onChange={async (v) => {
              setPub(v);
              if (await patchAccount({ profilePublic: v })) {
                toast(v ? "Profile is public" : "Profile is private", "info");
                router.refresh();
              } else setPub(!v);
            }}
            label="Public profile"
          />
        </Row>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 300))} rows={2} placeholder="A line about your taste in anime" className="input resize-none text-sm" />
        </label>
      </div>
    </SettingsCard>
  );
}

/* ───────── Alerts ───────── */

export function AlertsCard({ discordWebhook, calendarOn }: { discordWebhook: string | null; calendarOn: boolean }) {
  const [hook, setHook] = useState(discordWebhook ?? "");
  const [calUrl, setCalUrl] = useState<string | null>(null);
  const [cal, setCal] = useState(calendarOn);

  async function makeFeed() {
    const res = await fetch("/api/account/calendar", { method: "POST" });
    const j = await res.json();
    if (res.ok) {
      setCalUrl(j.url);
      setCal(true);
    } else toast("Couldn't create feed", "error");
  }
  async function stopFeed() {
    await fetch("/api/account/calendar", { method: "DELETE" });
    setCal(false);
    setCalUrl(null);
    toast("Calendar feed turned off", "info");
  }

  return (
    <SettingsCard id="alerts" title="Alerts & calendar" description="New episodes, replies and follows always show up under the bell on this site. These are optional extras.">
      <div className="divide-y divide-white/[0.06]">
        <div className="py-3 pt-0">
          <div className="text-sm">Discord alerts</div>
          <div className="mt-0.5 text-xs text-muted">Paste a webhook URL from a channel&apos;s Integrations settings.</div>
          <form onSubmit={async (e) => { e.preventDefault(); if (await patchAccount({ discordWebhook: hook || null })) toast(hook ? "Discord alerts on" : "Discord alerts off"); }} className="mt-2 flex gap-2">
            <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://discord.com/api/webhooks/…" className="input !py-2 font-mono !text-xs" aria-label="Discord webhook URL" />
            <button className="btn btn-ghost !py-2">Save</button>
          </form>
        </div>
        <div className="py-3 pb-0">
          <div className="text-sm">Calendar feed</div>
          <div className="mt-0.5 text-xs text-muted">Subscribe in Google or Apple Calendar to see airing times for shows you&apos;re watching or planning.</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {calUrl ? (
              <>
                <input readOnly value={calUrl} className="input !py-2 font-mono !text-xs" onFocus={(e) => e.target.select()} aria-label="Calendar URL" />
                <button onClick={() => navigator.clipboard.writeText(calUrl).then(() => toast("Copied"))} className="btn btn-ghost !py-2">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </>
            ) : (
              <button onClick={makeFeed} className="btn btn-ghost !py-2">
                {cal ? "Show a new feed link" : "Create feed link"}
              </button>
            )}
            {cal && (
              <button onClick={stopFeed} className="btn btn-ghost !py-2 text-muted">
                Turn off
              </button>
            )}
          </div>
          {calUrl && <p className="mt-2 text-xs text-muted">Keep this link private. Creating a new one disables the old link.</p>}
        </div>
      </div>
    </SettingsCard>
  );
}

/* ───────── Security ───────── */

function RecoveryKeySection({ hasKey: initial }: { hasKey: boolean }) {
  const [hasKey, setHasKey] = useState(initial);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/account/recovery-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(json.error ?? "Couldn't create a recovery key", "error");
    setUsername(json.username);
    setKey(json.recoveryKey);
    setHasKey(true);
    setOpen(false);
    setPassword("");
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <KeyRound className={`h-4 w-4 ${hasKey ? "text-success" : "text-amber-300"}`} /> Recovery key
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {hasKey ? "Lets you reset your password if you forget it. Making a new one disables the old one." : "You don't have one yet. Without it, only an admin can reset a forgotten password."}
          </div>
        </div>
        {!open && !key && (
          <button onClick={() => setOpen(true)} className={`btn !py-2 ${hasKey ? "btn-ghost" : "btn-primary"}`}>
            {hasKey ? "Make a new key" : "Create key"}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form onSubmit={generate} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-4 flex flex-wrap gap-2">
              <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Confirm your password" className="input !w-56 !py-2 text-sm" aria-label="Password" autoComplete="current-password" />
              <button disabled={busy || !password} className="btn btn-primary !py-2">
                {busy && <LoaderCircle className="spin h-4 w-4" />} {hasKey ? "Replace key" : "Create key"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost !py-2">
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      {key && (
        <div className="mt-4 max-w-md rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <p className="mb-3 text-xs text-muted">Save this now. It won&apos;t be shown again.</p>
          <RecoveryKey value={key} username={username} onDone={() => setKey(null)} doneLabel="Done" />
        </div>
      )}
    </div>
  );
}

type Sess = { id: string; userAgent: string; ip: string; createdAt: string; lastSeenAt: string; current: boolean };

function device(ua: string) {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return { label: `${browser} on ${os}`, mobile: /Android|iPhone|iPad/.test(ua) };
}

export function SecurityCard({ totpEnabled, hasRecoveryKey }: { totpEnabled: boolean; hasRecoveryKey: boolean }) {
  const [enabled, setEnabled] = useState(totpEnabled);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<Sess[] | null>(null);

  const loadSessions = () =>
    fetch("/api/account/sessions")
      .then((r) => r.json())
      .then((j) => setSessions(j.sessions ?? []))
      .catch(() => setSessions([]));
  useEffect(() => {
    loadSessions();
  }, []);

  async function call(body: object) {
    setBusy(true);
    const res = await fetch("/api/account/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) toast(json.error ?? "Something went wrong", "error");
    return res.ok ? json : null;
  }

  return (
    <SettingsCard id="security" title="Security" description="Your recovery key, two-factor authentication and where you're signed in.">
      <div className="space-y-6">
        <RecoveryKeySection hasKey={hasRecoveryKey} />

        <div className="border-t border-white/[0.06] pt-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className={`h-4 w-4 ${enabled ? "text-success" : "text-muted"}`} /> Two-factor authentication
              </div>
              <div className="mt-0.5 text-xs text-muted">{enabled ? "On — you'll enter a code from your authenticator app when logging in." : "Use an app like Google Authenticator, 1Password or Authy."}</div>
            </div>
            {!enabled && !setup && (
              <button onClick={async () => { const j = await call({ action: "setup" }); if (j) setSetup({ secret: j.secret, qr: j.qr }); }} disabled={busy} className="btn btn-primary !py-2">
                Set up
              </button>
            )}
          </div>

          <AnimatePresence>
            {setup && !enabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-4 flex flex-wrap gap-5 rounded-xl bg-white/[0.03] p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={setup.qr} alt="QR code for your authenticator app" className="h-40 w-40 rounded-lg bg-[#fff] p-1" />
                  <div className="min-w-0 flex-1 space-y-3 text-sm">
                    <p>1. Scan the QR code with your authenticator app.</p>
                    <p className="text-xs text-muted">
                      Can&apos;t scan? Enter this key: <code className="break-all font-mono text-fg">{setup.secret}</code>
                    </p>
                    <p>2. Enter the 6-digit code it shows.</p>
                    <form onSubmit={async (e) => { e.preventDefault(); const j = await call({ action: "enable", code }); if (j) { setEnabled(true); setSetup(null); setCodes(j.recoveryCodes); setCode(""); } }} className="flex gap-2">
                      <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" className="input !w-32 !py-2 text-center font-mono tracking-widest" aria-label="Authentication code" />
                      <button disabled={busy || code.length !== 6} className="btn btn-primary !py-2">
                        {busy && <LoaderCircle className="spin h-4 w-4" />} Turn on
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {codes && (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <div className="text-sm font-medium">Save your recovery codes</div>
              <p className="mt-0.5 text-xs text-muted">Each works once if you lose your device. They won&apos;t be shown again.</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm sm:grid-cols-5">
                {codes.map((c) => (
                  <span key={c} className="rounded bg-black/20 px-2 py-1 text-center">{c}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => toast("Copied"))} className="btn btn-ghost !py-1.5 !text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <button onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" })); a.download = "anikumo-recovery-codes.txt"; a.click(); }} className="btn btn-ghost !py-1.5 !text-xs">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
                <button onClick={() => setCodes(null)} className="btn btn-ghost !py-1.5 !text-xs">
                  <Check className="h-3.5 w-3.5" /> I saved them
                </button>
              </div>
            </div>
          )}

          {enabled && !codes && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
                const action = submitter?.value === "recovery" ? "recovery" : "disable";
                const j = await call({ action, password, code });
                if (!j) return;
                if (action === "disable") {
                  setEnabled(false);
                  toast("Two-factor turned off", "info");
                } else setCodes(j.recoveryCodes);
                setPassword("");
                setCode("");
              }}
              className="mt-4 flex flex-wrap gap-2"
            >
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="input !w-40 !py-2 text-sm" aria-label="Password" autoComplete="current-password" />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Current code" maxLength={6} className="input !w-32 !py-2 font-mono text-sm" aria-label="Current code" />
              <button value="recovery" disabled={busy || !password} className="btn btn-ghost !py-2 !text-xs">New recovery codes</button>
              <button value="disable" disabled={busy || !password || code.length !== 6} className="btn btn-ghost !py-2 !text-xs text-red-300">Turn off</button>
            </form>
          )}
        </div>
        </div>

        <div className="border-t border-white/[0.06] pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm">Active sessions</div>
            {sessions && sessions.length > 1 && (
              <button
                onClick={async () => {
                  const res = await fetch("/api/account/sessions?others=1", { method: "DELETE" });
                  const j = await res.json();
                  if (res.ok) {
                    toast(`Signed out of ${j.count} other device${j.count === 1 ? "" : "s"}`);
                    loadSessions();
                  }
                }}
                className="text-xs text-muted hover:text-fg"
              >
                Log out of all other devices
              </button>
            )}
          </div>
          {sessions === null ? (
            <div className="skeleton h-14 rounded-xl" />
          ) : (
            <ul className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
              {sessions.map((s) => {
                const d = device(s.userAgent);
                const Icon = d.mobile ? Smartphone : Monitor;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon className="h-4 w-4 text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        {d.label} {s.current && <span className="ml-1 rounded bg-success/15 px-1.5 font-mono text-[10px] text-success">this device</span>}
                      </div>
                      <div className="font-mono text-[11px] text-muted">
                        {s.ip} · last active {new Date(s.lastSeenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    {!s.current && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/account/sessions?id=${s.id}`, { method: "DELETE" });
                          setSessions((list) => list?.filter((x) => x.id !== s.id) ?? null);
                        }}
                        className="text-xs text-muted hover:text-fg"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}

/* ───────── Import ───────── */

export function ImportCard() {
  const router = useRouter();
  const [source, setSource] = useState<"anilist" | "mal">("anilist");
  const [username, setUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; unmatched: number } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set("source", source);
    if (overwrite) form.set("overwrite", "1");
    if (source === "anilist") form.set("username", username.trim());
    else if (file) form.set("file", file);
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/import", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(json.error ?? "Import failed", "error");
    setResult(json);
    toast("Import finished");
    router.refresh();
  }

  return (
    <SettingsCard id="import" title="Import your list" description="Bring your statuses, scores and progress from another tracker.">
      <form onSubmit={run} className="space-y-4">
        <div className="flex rounded-xl bg-white/[0.05] p-1 text-sm sm:w-fit">
          {(["anilist", "mal"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)} className={`flex-1 rounded-lg px-4 py-1.5 transition-colors ${source === s ? "bg-white/[0.1] text-fg" : "text-muted hover:text-fg"}`}>
              {s === "anilist" ? "AniList" : "MyAnimeList"}
            </button>
          ))}
        </div>
        {source === "anilist" ? (
          <label className="block max-w-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted">AniList username (list must be public)</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="input text-sm" placeholder="username" />
          </label>
        ) : (
          <div className="max-w-md">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Export from myanimelist.net → Profile → Export. Upload the <code>.xml</code> or <code>.xml.gz</code> file.
            </span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/[0.12] px-4 py-3 text-sm text-muted transition-colors hover:border-white/25 hover:text-fg">
              <Upload className="h-4 w-4" />
              <span className="truncate">{file ? file.name : "Choose animelist.xml"}</span>
              <input type="file" accept=".xml,.gz,application/xml,text/xml,application/gzip" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Toggle on={overwrite} onChange={setOverwrite} label="Overwrite existing entries" /> Overwrite statuses and scores already on my list
        </label>
        <button disabled={busy || (source === "anilist" ? !username.trim() : !file)} className="btn btn-primary">
          {busy && <LoaderCircle className="spin h-4 w-4" />} {busy ? "Importing…" : "Import"}
        </button>
        {result && (
          <p className="font-mono text-xs text-muted">
            {result.imported} added · {result.updated} updated · {result.skipped} unchanged{result.unmatched ? ` · ${result.unmatched} couldn't be matched` : ""}
          </p>
        )}
      </form>
    </SettingsCard>
  );
}

/* ───────── Keyboard ───────── */

export function KeyboardCard({ shortcuts }: { shortcuts: Prefs["shortcuts"] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(shortcuts);
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") return setCapturing(null);
      const k = e.key.toLowerCase();
      if (!/^[a-z0-9?/]$/.test(k)) return toast("Use a letter, number, / or ?", "info");
      if (k === "g" && capturing !== "help" && capturing !== "palette") return toast("G starts “go to” combos — pick another key", "info");
      const clash = (Object.keys(keys) as ShortcutAction[]).find((a) => a !== capturing && keys[a] === k && a.startsWith("go") === capturing.startsWith("go"));
      if (clash) return toast(`${k.toUpperCase()} is already used for “${SHORTCUT_LABELS[clash]}”`, "info");
      const next = { ...keys, [capturing]: k };
      setKeys(next);
      setCapturing(null);
      patchPrefs({ shortcuts: next }).then((ok) => ok && router.refresh());
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [capturing, keys, router]);

  return (
    <SettingsCard
      id="keyboard"
      title="Keyboard shortcuts"
      description="Click a key to change it. “Go to” shortcuts are pressed after G."
      footer={
        <>
          <span className="text-xs text-muted">Press ? anywhere to see them.</span>
          <button
            onClick={() => {
              setKeys(DEFAULT_SHORTCUTS);
              patchPrefs({ shortcuts: DEFAULT_SHORTCUTS }).then((ok) => ok && router.refresh());
            }}
            className="btn btn-ghost"
          >
            Reset to defaults
          </button>
        </>
      }
    >
      <div className="grid gap-x-8 sm:grid-cols-2">
        {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((a) => (
          <div key={a} className="flex items-center justify-between border-b border-white/[0.05] py-2 text-sm">
            <span className="text-fg/85">{SHORTCUT_LABELS[a]}</span>
            <span className="flex items-center gap-1">
              {a.startsWith("go") && <kbd className="rounded border border-white/10 px-1.5 font-mono text-[11px] text-muted">G</kbd>}
              {a === "palette" && <kbd className="rounded border border-white/10 px-1.5 font-mono text-[11px] text-muted">Ctrl</kbd>}
              <button onClick={() => setCapturing(a)} className={`min-w-8 rounded-md border px-2 py-0.5 font-mono text-xs transition-colors ${capturing === a ? "animate-pulse border-accent text-accent" : "border-white/15 hover:border-white/30"}`}>
                {capturing === a ? "press…" : keys[a].toUpperCase()}
              </button>
            </span>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
