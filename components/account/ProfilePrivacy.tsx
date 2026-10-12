"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImageIcon, LoaderCircle, Search, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { SECTIONS, VISIBILITIES, type Section, type Sections, type Visibility } from "@/lib/privacy-shared";
import { Toggle } from "../list/EntryEditor";
import { Row, SettingsCard } from "./SettingsCard";

type Banner = { id: number; title: string; image: string };
export type PrivacyUser = {
  username: string;
  bio: string;
  profileBanner: string;
  profileVisibility: Visibility;
  profileSections: Sections;
  searchable: boolean;
  onLeaderboard: boolean;
  allowFollows: boolean;
};

async function patchAccount(body: object) {
  const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) toast(json.error ?? "Couldn't save", "error");
  return res.ok;
}

/** Banner, bio, who can see the profile, which parts they see, and discoverability. */
export function ProfilePrivacyCard({ user }: { user: PrivacyUser }) {
  const router = useRouter();
  const [bio, setBio] = useState(user.bio);
  const [banner, setBanner] = useState(user.profileBanner);
  const [visibility, setVisibility] = useState<Visibility>(user.profileVisibility);
  const [sections, setSections] = useState<Sections>(user.profileSections);
  const [flags, setFlags] = useState({ searchable: user.searchable, onLeaderboard: user.onLeaderboard, allowFollows: user.allowFollows });
  const [picking, setPicking] = useState(false);

  async function save(body: object, done: string, undo: () => void) {
    if (await patchAccount(body)) {
      toast(done, "info");
      router.refresh();
    } else undo();
  }

  const hidden = visibility === "private";

  return (
    <SettingsCard
      id="visibility"
      title="Profile & privacy"
      description="Choose what your profile looks like and exactly who can see what."
      footer={
        <>
          <a href={`/u/${user.username}`} className="font-mono text-[11px] text-muted hover:text-fg">
            /u/{user.username} ↗
          </a>
          <button onClick={() => save({ bio }, "Bio saved", () => {})} disabled={bio === user.bio} className="btn btn-primary">
            Save bio
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Banner */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Banner</span>
          <div className="relative aspect-[4/1] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]">
            {banner ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={banner} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4" /> No banner yet
                </span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              {banner && (
                <button
                  onClick={() => {
                    const prev = banner;
                    setBanner("");
                    save({ profileBanner: "" }, "Banner removed", () => setBanner(prev));
                  }}
                  className="glass-strong rounded-lg px-2.5 py-1 text-xs"
                >
                  Remove
                </button>
              )}
              <button onClick={() => setPicking((p) => !p)} className="glass-strong rounded-lg px-2.5 py-1 text-xs">
                {picking ? "Close" : banner ? "Change" : "Choose a banner"}
              </button>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {picking && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <BannerPicker
                  current={banner}
                  onPick={(b) => {
                    const prev = banner;
                    setBanner(b.image);
                    setPicking(false);
                    save({ profileBanner: b.image }, `Banner set to ${b.title}`, () => setBanner(prev));
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 300))} rows={2} placeholder="A line about your taste in anime" className="input resize-none text-sm" />
        </label>

        {/* Who can see it */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Who can see your profile</span>
          <div className="grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Who can see your profile">
            {VISIBILITIES.map((v) => (
              <button
                key={v.value}
                role="radio"
                aria-checked={visibility === v.value}
                onClick={() => {
                  if (v.value === visibility) return;
                  const prev = visibility;
                  setVisibility(v.value);
                  save({ profileVisibility: v.value }, v.value === "everyone" ? "Profile is public" : v.value === "followers" ? "Only followers can see your profile" : "Profile is private", () => setVisibility(prev));
                }}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${visibility === v.value ? "border-accent/60 bg-accent/[0.08]" : "border-white/[0.07] hover:border-white/15"}`}
              >
                <div className="text-sm font-medium">{v.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted">{v.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className={hidden ? "pointer-events-none opacity-40" : ""} aria-disabled={hidden}>
          <span className="mb-1 block text-xs font-medium text-muted">What visitors see {hidden && "· your profile is private"}</span>
          <div className="divide-y divide-white/[0.05]">
            {(Object.keys(SECTIONS) as Section[]).map((k) => (
              <Row key={k} title={SECTIONS[k]}>
                <Toggle
                  on={sections[k]}
                  onChange={(on) => {
                    const next = { ...sections, [k]: on };
                    setSections(next);
                    save({ profileSections: next }, `${SECTIONS[k]} ${on ? "shown" : "hidden"}`, () => setSections(sections));
                  }}
                  label={SECTIONS[k]}
                />
              </Row>
            ))}
          </div>
        </div>

        {/* Discoverability */}
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Discoverability</span>
          <div className="divide-y divide-white/[0.05]">
            {(
              [
                ["searchable", "Show me in member search", "People can find you by typing your username"],
                ["onLeaderboard", "Show me on the leaderboard", "Only applies when your profile is public"],
                ["allowFollows", "Let people follow me", "Turning this off keeps your current followers"],
              ] as const
            ).map(([key, title, hint]) => (
              <Row key={key} title={title} hint={hint}>
                <Toggle
                  on={flags[key]}
                  onChange={(on) => {
                    setFlags((f) => ({ ...f, [key]: on }));
                    save({ [key]: on }, "Saved", () => setFlags((f) => ({ ...f, [key]: !on })));
                  }}
                  label={title}
                />
              </Row>
            ))}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

function BannerPicker({ current, onPick }: { current: string; onPick: (b: Banner) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Banner[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(
      () => {
        setItems(null);
        fetch(`/api/banners?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
          .then((r) => r.json())
          .then((j) => setItems(j.banners ?? []))
          .catch(() => {});
      },
      q ? 300 : 0,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an anime for its banner" className="input !pl-9 !pr-9 text-sm" aria-label="Search banners" />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label="Clear search">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-3 max-h-[320px] overflow-y-auto overscroll-contain pr-1">
        {items === null ? (
          <div className="grid h-24 place-items-center">
            <LoaderCircle className="spin h-4 w-4 text-muted" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No banners found{q ? ` for “${q}”` : ""}.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {!q && <p className="col-span-full -mb-0.5 text-[11px] text-muted">Trending right now</p>}
            {items.map((b) => (
              <button key={b.id} onClick={() => onPick(b)} title={b.title} className={`group relative aspect-[4/1] overflow-hidden rounded-lg ring-offset-2 ring-offset-bg transition ${current === b.image ? "ring-2 ring-accent" : "hover:opacity-90"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-1 pt-4 text-left text-[11px] text-white">{b.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
