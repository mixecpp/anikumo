"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Globe, LoaderCircle, Lock, Search, X } from "lucide-react";
import { toast } from "@/lib/toast";
import Turnstile from "../auth/Turnstile";

const CODE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (CODE.test(clean)) router.push(`/watch-together/${clean}`);
        else toast("Room codes are 6 letters and numbers", "error");
      }}
      className="panel rounded-xl p-4"
    >
      <h2 className="text-sm font-medium">Join with a code</h2>
      <div className="mt-2.5 flex gap-2">
        <input
          value={clean}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABC234"
          className="input flex-1 font-mono uppercase tracking-[0.25em]"
          aria-label="Room code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <button disabled={clean.length !== 6} className="btn btn-primary shrink-0">
          Join
        </button>
      </div>
    </form>
  );
}

type Anime = { id: number; title: string; cover: string };

export function AnimePicker({ value, onPick }: { value: Anime | null; onPick: (a: Anime | null) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return setItems([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setItems((j.results ?? []).map((r: Anime) => ({ id: r.id, title: r.title, cover: r.cover }))))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.cover} alt="" className="h-12 w-8 rounded object-cover" />
        <span className="min-w-0 flex-1 truncate text-sm">{value.title}</span>
        <button type="button" onClick={() => onPick(null)} className="rounded p-1 text-muted hover:text-fg" aria-label="Pick a different anime">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an anime" className="input !py-2 !pl-9 text-sm" aria-label="Search an anime" />
        {loading && <LoaderCircle className="spin absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
      </div>
      {items.length > 0 && (
        <ul className="mt-1.5 max-h-56 overflow-y-auto overscroll-contain">
          {items.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => onPick(a)} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-white/[0.05]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt="" className="h-10 w-7 rounded object-cover" />
                <span className="truncate text-sm">{a.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CreateRoom({ captchaKey, preset }: { captchaKey: string | null; preset?: { anime: Anime; episode: number } }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [anime, setAnime] = useState<Anime | null>(preset?.anime ?? null);
  const [episode, setEpisode] = useState(preset?.episode ?? 1);
  const [isPublic, setPublic] = useState(true);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!anime || busy) return;
    setBusy(true);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || `Watching ${anime.title}`.slice(0, 40), anilistId: anime.id, episode, isPublic, captcha }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (captchaKey) setNonce((n) => n + 1);
    if (!res.ok) return toast(json.error ?? "Couldn't start the room", "error");
    router.push(`/watch-together/${json.code}`);
  }

  return (
    <form onSubmit={submit} className="panel space-y-3 rounded-xl p-4">
      <h2 className="text-sm font-medium">Start a room</h2>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder={anime ? `Watching ${anime.title}`.slice(0, 40) : "Room name"} className="input text-sm" aria-label="Room name" />
      <AnimePicker value={anime} onPick={setAnime} />
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">Episode</span>
        <input type="number" min={1} max={5000} value={episode} onChange={(e) => setEpisode(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} className="input w-24 !py-1.5 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Who can find the room">
        {(
          [
            [true, Globe, "Public", "Listed for anyone"],
            [false, Lock, "Private", "Code only"],
          ] as const
        ).map(([value, Icon, label, hint]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={isPublic === value}
            onClick={() => setPublic(value)}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${isPublic === value ? "border-accent/60 bg-accent/[0.08]" : "border-white/[0.07] hover:border-white/15"}`}
          >
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <div className="text-[11px] text-muted">{hint}</div>
          </button>
        ))}
      </div>
      {captchaKey && <Turnstile siteKey={captchaKey} action="room" onToken={setCaptcha} nonce={nonce} />}
      <button disabled={busy || !anime || (!!captchaKey && !captcha)} className="btn btn-primary w-full">
        {busy && <LoaderCircle className="spin h-4 w-4" />} {captchaKey && !captcha && anime ? "Checking your browser…" : "Start room"}
      </button>
    </form>
  );
}
