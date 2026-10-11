"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, Database, Download, Eye, EyeOff, Globe, KeyRound, Keyboard, LoaderCircle, ShieldCheck, SlidersHorizontal, TriangleAlert, Upload, UserRound } from "lucide-react";
import type { Prefs } from "@/lib/prefs-shared";
import { AlertsCard, ImportCard, KeyboardCard, PreferencesCard, ProfileVisibilityCard, SecurityCard } from "./SettingsExtra";
import { toast } from "@/lib/toast";
import { Avatar } from "../UserMenu";
import ConfirmButton from "./ConfirmButton";

const COLORS = ["#f6a57c", "#fb7185", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#71717a"];

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "visibility", label: "Public profile", icon: Globe },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "password", label: "Password", icon: KeyRound },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "import", label: "Import", icon: Upload },
  { id: "keyboard", label: "Keyboard", icon: Keyboard },
  { id: "data", label: "Your data", icon: Database },
  { id: "danger", label: "Delete account", icon: TriangleAlert },
] as const;

type User = {
  username: string;
  avatarColor: string;
  bio: string;
  profilePublic: boolean;
  discordWebhook: string | null;
  calendarOn: boolean;
  totpEnabled: boolean;
  hasRecoveryKey: boolean;
};

async function patch(body: object) {
  const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, error: json.error as string | undefined };
}

function Card({
  id,
  title,
  description,
  children,
  footer,
  danger,
  onSubmit,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
  onSubmit?: (e: React.FormEvent) => void;
}) {
  const Tag = onSubmit ? "form" : "div";
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border ${danger ? "border-red-500/25" : "border-white/[0.07]"} bg-panel`}
    >
      <Tag onSubmit={onSubmit} className="block">
        <div className="p-6">
          <h2 className={`text-base font-semibold tracking-tight ${danger ? "text-red-300" : ""}`}>{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className={`flex min-h-14 items-center justify-between gap-4 border-t px-6 py-3 ${danger ? "border-red-500/20 bg-red-500/[0.04]" : "border-white/[0.06] bg-white/[0.015]"}`}>
            {footer}
          </div>
        )}
      </Tag>
    </motion.section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] text-muted">{children}</p>;
}

function SaveButton({ busy, done, disabled, label = "Save", danger }: { busy: boolean; done?: boolean; disabled?: boolean; label?: string; danger?: boolean }) {
  return (
    <button disabled={busy || disabled} className={`btn min-w-24 overflow-hidden ${danger ? "bg-red-500 text-white hover:bg-red-400" : "btn-primary"}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={busy ? "busy" : done ? "done" : "idle"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1.5"
        >
          {busy ? <LoaderCircle className="spin h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : null}
          {busy ? "Saving" : done ? "Saved" : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className="input !pr-10 text-sm" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = ["bg-red-400", "bg-red-400", "bg-amber-400", "bg-success", "bg-success"];

function useDone(): [boolean, () => void] {
  const [done, setDone] = useState(false);
  return [
    done,
    () => {
      setDone(true);
      setTimeout(() => setDone(false), 2200);
    },
  ];
}

export default function SettingsForms({ user, prefs }: { user: User; prefs: Prefs }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>("profile");

  const [username, setUsername] = useState(user.username);
  const [color, setColor] = useState(user.avatarColor);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileDone, markProfileDone] = useDone();

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, markPwDone] = useDone();

  const [deletePw, setDeletePw] = useState("");
  const [deleteName, setDeleteName] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) return setActiveSection(SECTIONS[SECTIONS.length - 1].id);
      const line = window.innerHeight * 0.3;
      let current: string = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActiveSection(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const profileDirty = username !== user.username || color !== user.avatarColor;
  const s = strength(pw.next);
  const pwMismatch = pw.confirm.length > 0 && pw.next !== pw.confirm;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameValid) return;
    setProfileBusy(true);
    const r = await patch({ username, avatarColor: color });
    setProfileBusy(false);
    if (!r.ok) return toast(r.error ?? "Couldn't save profile", "error");
    markProfileDone();
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return;
    setPwBusy(true);
    const r = await patch({ currentPassword: pw.current, newPassword: pw.next });
    setPwBusy(false);
    if (!r.ok) return toast(r.error ?? "Couldn't change password", "error");
    setPw({ current: "", next: "", confirm: "" });
    markPwDone();
  }

  async function clearHistory() {
    const res = await fetch("/api/progress?all=1", { method: "DELETE" });
    if (!res.ok) return toast("Couldn't clear history", "error");
    const { count } = await res.json();
    toast(`Cleared ${count} history entr${count === 1 ? "y" : "ies"}`, "info");
    router.refresh();
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteBusy(true);
    const res = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePw }) });
    setDeleteBusy(false);
    if (!res.ok) return toast((await res.json().catch(() => ({}))).error ?? "Couldn't delete account", "error");
    toast("Your account has been deleted", "info");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
      <nav className="hidden lg:block">
        <ul className="sticky top-24 space-y-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const on = activeSection === id;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveSection(id);
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${on ? "text-fg" : "text-muted hover:text-fg"} ${id === "danger" && on ? "!text-red-300" : ""}`}
                >
                  {on && <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-lg bg-white/[0.07]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-6 lg:pb-[50vh]">
        <Card
          id="profile"
          title="Profile"
          description="Your public name and avatar, shown next to your comments."
          onSubmit={saveProfile}
          footer={
            <>
              <Hint>{usernameValid ? "Letters, numbers and underscores, 3–20 characters." : "Username must be 3–20 letters, numbers or underscores."}</Hint>
              <SaveButton busy={profileBusy} done={profileDone} disabled={!profileDirty || !usernameValid} />
            </>
          }
        >
          <div className="grid gap-6 md:grid-cols-[1fr_260px]">
            <div className="space-y-5">
              <Field label="Username">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`input text-sm ${!usernameValid ? "!border-red-400/50" : ""}`}
                  autoComplete="username"
                  maxLength={20}
                />
              </Field>
              <div>
                <span className="mb-2 block text-xs font-medium text-muted">Avatar colour</span>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <motion.button
                      key={c}
                      type="button"
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setColor(c)}
                      aria-label={`Avatar colour ${c}`}
                      aria-pressed={color === c}
                      className="relative grid h-7 w-7 place-items-center rounded-full"
                      style={{ background: c }}
                    >
                      {color === c && (
                        <motion.span layoutId="avatar-color" className="absolute -inset-[3px] rounded-full ring-2 ring-white" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-4">
              <span className="label">Preview</span>
              <div className="mt-3 flex gap-3">
                <motion.div key={color} initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                  <Avatar name={username || user.username} color={color} size={32} />
                </motion.div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium">{username || user.username}</span>
                    <span className="font-mono text-[11px] text-muted">just now</span>
                  </div>
                  <p className="mt-1 text-sm text-fg/70">That ending was incredible.</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <ProfileVisibilityCard username={user.username} bio={user.bio} profilePublic={user.profilePublic} />
        <PreferencesCard prefs={prefs} />
        <AlertsCard discordWebhook={user.discordWebhook} calendarOn={user.calendarOn} />

        <Card
          id="password"
          title="Password"
          description="Use a long passphrase you don't use anywhere else."
          onSubmit={savePassword}
          footer={
            <>
              <Hint>{pwMismatch ? "Passwords don't match." : "At least 8 characters."}</Hint>
              <SaveButton busy={pwBusy} done={pwDone} label="Update password" disabled={!pw.current || pw.next.length < 8 || pw.next !== pw.confirm} />
            </>
          }
        >
          <div className="max-w-md space-y-4">
            <Field label="Current password">
              <PasswordInput value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
            </Field>
            <Field label="New password">
              <PasswordInput value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} required />
            </Field>
            <div className="flex items-center gap-3">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.span
                      className={`block h-full ${STRENGTH_COLOR[s]}`}
                      initial={false}
                      animate={{ width: pw.next && s >= n ? "100%" : "0%" }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </span>
                ))}
              </div>
              <span className="w-16 text-right font-mono text-[11px] text-muted">{pw.next ? STRENGTH[s] : ""}</span>
            </div>
            <Field label="Confirm new password">
              <PasswordInput value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" required />
            </Field>
          </div>
        </Card>

        <SecurityCard totpEnabled={user.totpEnabled} hasRecoveryKey={user.hasRecoveryKey} />
        <ImportCard />
        <KeyboardCard shortcuts={prefs.shortcuts} />

        <Card id="data" title="Your data" description="Take your history with you, or start over.">
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm">Export your data</div>
                <div className="mt-0.5 text-xs text-muted">A JSON file with your watch history, favorites and comments.</div>
              </div>
              <a href="/api/account/export" className="btn btn-ghost">
                <Download className="h-4 w-4" /> Download
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm">Clear watch history</div>
                <div className="mt-0.5 text-xs text-muted">Removes all progress and Continue Watching. Favorites stay.</div>
              </div>
              <ConfirmButton onConfirm={clearHistory} label="Clear history" confirmLabel="Click again to confirm" className="!py-2.5" />
            </div>
          </div>
        </Card>

        <Card
          id="danger"
          danger
          title="Delete account"
          description="Permanently delete your account, history, favorites and comments. This can't be undone."
          onSubmit={deleteAccount}
          footer={
            <>
              <Hint>Type your username and password to confirm.</Hint>
              <SaveButton busy={deleteBusy} danger label="Delete account" disabled={deleteName !== user.username || !deletePw} />
            </>
          }
        >
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <Field label={`Type “${user.username}”`}>
              <input value={deleteName} onChange={(e) => setDeleteName(e.target.value)} className="input text-sm" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Password">
              <PasswordInput value={deletePw} onChange={(e) => setDeletePw(e.target.value)} autoComplete="current-password" />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
