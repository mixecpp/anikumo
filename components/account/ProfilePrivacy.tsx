"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { SECTIONS, VISIBILITIES, WALL_SETTINGS, type Section, type Sections, type Visibility, type WallSetting } from "@/lib/privacy-shared";
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
  profileComments: WallSetting;
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
  const [visibility, setVisibility] = useState<Visibility>(user.profileVisibility);
  const [sections, setSections] = useState<Sections>(user.profileSections);
  const [flags, setFlags] = useState({ searchable: user.searchable, onLeaderboard: user.onLeaderboard, allowFollows: user.allowFollows });
  const [wall, setWall] = useState<WallSetting>(user.profileComments);

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
      description="Choose exactly who can see your profile, what they see and who can comment."
      footer={
        <a href={`/u/${user.username}`} className="font-mono text-[11px] text-muted hover:text-fg">
          /u/{user.username} ↗
        </a>
      }
    >
      <div className="space-y-6">
        <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-xs text-muted">
          Your banner, picture and bio are edited right on{" "}
          <a href={`/u/${user.username}`} className="text-fg underline-offset-2 hover:underline">
            your profile
          </a>{" "}
          — tap the pencil at the top.
        </p>


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

        {/* Profile comments */}
        <div className={hidden ? "pointer-events-none opacity-40" : ""} aria-disabled={hidden}>
          <span className="mb-1.5 block text-xs font-medium text-muted">Who can comment on your profile</span>
          <div className="grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Who can comment on your profile">
            {WALL_SETTINGS.map((v) => (
              <button
                key={v.value}
                role="radio"
                aria-checked={wall === v.value}
                onClick={() => {
                  if (v.value === wall) return;
                  const prev = wall;
                  setWall(v.value);
                  save({ profileComments: v.value }, v.value === "off" ? "Profile comments turned off" : v.value === "followers" ? "Only followers can comment" : "Anyone can comment", () => setWall(prev));
                }}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${wall === v.value ? "border-accent/60 bg-accent/[0.08]" : "border-white/[0.07] hover:border-white/15"}`}
              >
                <div className="text-sm font-medium">{v.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted">{v.hint}</div>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">You can delete any comment left on your profile.</p>
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

export function BannerPicker({ current, onPick }: { current: string; onPick: (b: Banner) => void }) {
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
