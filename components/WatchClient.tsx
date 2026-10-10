"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoPlayer, { type Skip } from "./VideoPlayer";

type Source = {
  provider: string;
  label: string;
  kind: "video" | "youtube" | "external";
  url: string;
  subtitles?: { label: string; lang: string; url: string }[];
  thumbnail?: string;
  note?: string;
};
type ProviderResult = { id: string; name: string; sources: Source[]; error?: string };

type Props = {
  anilistId: number;
  episode: number;
  idMal: number | null;
  title: string;
  coverImage: string;
  resumeAt: number;
  completed: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  loggedIn: boolean;
};

export default function WatchClient(p: Props) {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderResult[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [skips, setSkips] = useState<Skip[]>([]);
  const [watched, setWatched] = useState(p.completed);

  useEffect(() => {
    let alive = true;
    setProviders(null);
    setSelected(null);
    fetch(`/api/sources?id=${p.anilistId}&ep=${p.episode}`)
      .then((r) => r.json())
      .then((j) => alive && setProviders(j.providers ?? []))
      .catch(() => alive && setProviders([]));
    if (p.idMal) {
      fetch(`/api/skip?malId=${p.idMal}&ep=${p.episode}`)
        .then((r) => r.json())
        .then((j) => alive && setSkips(j.skips ?? []))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [p.anilistId, p.episode, p.idMal]);

  const all = useMemo(() => providers?.flatMap((pr) => pr.sources) ?? [], [providers]);
  const playable = all.filter((s) => s.kind !== "external");
  const external = all.filter((s) => s.kind === "external");

  useEffect(() => {
    if (!selected && playable.length) setSelected(playable[0].url);
  }, [playable, selected]);

  const current = playable.find((s) => s.url === selected) ?? null;

  const meta = useRef({ title: p.title, coverImage: p.coverImage, anilistId: p.anilistId, episode: p.episode, loggedIn: p.loggedIn });
  meta.current = { title: p.title, coverImage: p.coverImage, anilistId: p.anilistId, episode: p.episode, loggedIn: p.loggedIn };

  const save = useCallback((progressSeconds: number, durationSeconds: number, opts: { final?: boolean; completed?: boolean } = {}) => {
    const m = meta.current;
    if (!m.loggedIn) return;
    const body = JSON.stringify({
      anilistId: m.anilistId,
      episode: m.episode,
      progressSeconds,
      durationSeconds,
      title: m.title,
      coverImage: m.coverImage,
      completed: opts.completed,
    });
    if (opts.final && navigator.sendBeacon) {
      navigator.sendBeacon("/api/progress", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
        .then((r) => r.json())
        .then((j) => j.completed && setWatched(true))
        .catch(() => {});
    }
  }, []);

  const onProgress = useCallback((c: number, d: number, final?: boolean) => save(c, d, { final }), [save]);
  const onEnded = useCallback(() => {
    save(1, 1, { completed: true });
    setWatched(true);
  }, [save]);
  const goNext = useCallback(() => router.push(`/watch/${p.anilistId}/${p.episode + 1}`), [router, p.anilistId, p.episode]);

  useEffect(() => {
    if (current?.kind === "youtube") save(0, 0);
  }, [current?.kind, current?.url, save]);

  function markWatched() {
    save(1, 1, { completed: true });
    setWatched(true);
  }

  return (
    <div>
      {providers === null ? (
        <div className="skeleton aspect-video w-full rounded-2xl" />
      ) : current?.kind === "video" ? (
        <VideoPlayer
          key={current.url}
          src={current.url}
          subtitles={current.subtitles ?? []}
          resumeAt={p.completed ? 0 : p.resumeAt}
          skips={skips}
          hasNext={p.hasNext}
          onProgress={onProgress}
          onEnded={onEnded}
          onNext={goNext}
        />
      ) : current?.kind === "youtube" ? (
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <iframe
            key={current.url}
            src={current.url}
            title={current.note ?? "Episode"}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <NoSource external={external} episode={p.episode} providers={providers} />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {p.hasPrev && (
          <Link href={`/watch/${p.anilistId}/${p.episode - 1}`} className="btn btn-ghost !py-2">
            ← Ep {p.episode - 1}
          </Link>
        )}
        {p.hasNext && (
          <Link href={`/watch/${p.anilistId}/${p.episode + 1}`} className="btn btn-ghost !py-2">
            Ep {p.episode + 1} →
          </Link>
        )}
        {p.loggedIn && (
          <button onClick={markWatched} disabled={watched} className="btn btn-ghost !py-2">
            {watched ? "✓ Watched" : "Mark as watched"}
          </button>
        )}
        {!p.loggedIn && (
          <span className="text-sm text-muted">
            <Link href="/login" className="text-accent hover:underline">
              Log in
            </Link>{" "}
            to save your progress
          </span>
        )}
      </div>

      {playable.length > 0 && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sources</div>
          <div className="flex flex-wrap gap-2">
            {playable.map((s) => (
              <button
                key={s.url}
                onClick={() => setSelected(s.url)}
                title={s.note}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  s.url === selected ? "border-accent bg-accent/15 text-fg" : "border-line bg-surface-2 text-muted hover:text-fg"
                }`}
              >
                <div className="font-medium">{s.label}</div>
                {s.note && <div className="max-w-[260px] truncate text-xs text-muted">{s.note}</div>}
              </button>
            ))}
          </div>
          {external.length > 0 && <ExternalLinks external={external} />}
        </div>
      )}
    </div>
  );
}

function ExternalLinks({ external }: { external: Source[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
      {external.map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-surface-2 px-3 py-2 text-sm transition hover:bg-white/10"
          title={s.note}
        >
          {s.label} ↗
        </a>
      ))}
    </div>
  );
}

function NoSource({ external, episode, providers }: { external: Source[]; episode: number; providers: ProviderResult[] }) {
  const errors = providers.filter((p) => p.error);
  const hasYoutube = providers.some((p) => p.id === "youtube");
  return (
    <div className="grid aspect-video w-full place-items-center rounded-2xl border border-line bg-surface p-6">
      <div className="max-w-lg text-center">
        <div className="font-[family-name:var(--font-display)] text-2xl font-bold">No in-site source for episode {episode}</div>
        {external.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-muted">It&apos;s available officially here:</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {external.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="btn btn-primary !py-2" title={s.note}>
                  {s.label} ↗
                </a>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No official streaming links were found either.</p>
        )}
        <p className="mt-5 text-xs text-muted">
          Add the episode to your{" "}
          <Link href="/library" className="text-accent hover:underline">
            library
          </Link>
          {hasYoutube ? "" : ", or set YOUTUBE_API_KEY in .env to find official free uploads"}.
        </p>
        {errors.map((e) => (
          <p key={e.id} className="mt-1 text-xs text-accent/80">
            {e.name}: {e.error}
          </p>
        ))}
      </div>
    </div>
  );
}
