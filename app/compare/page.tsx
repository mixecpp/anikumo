import Link from "next/link";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getMedia, prettyEnum, type MediaDetail } from "@/lib/anilist";
import { getUi } from "@/lib/server-i18n";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STATUS_LABEL, isStatus } from "@/lib/list-shared";
import ComparePicker from "@/components/compare/ComparePicker";

export const metadata: Metadata = { title: "Compare", description: "Compare two anime side by side." };

type SP = Record<string, string | undefined>;

function runtime(m: MediaDetail) {
  const eps = m.episodes ?? (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null);
  if (!eps || !m.duration) return null;
  const mins = eps * m.duration;
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ids = [Number(sp.a), Number(sp.b)].map((n) => (Number.isInteger(n) && n > 0 ? n : null));
  const [{ title }, userId] = await Promise.all([getUi(), getUserId()]);
  const [ma, mb] = await Promise.all(ids.map((id) => (id ? getMedia(id).catch(() => null) : Promise.resolve(null))));
  const both = ma && mb ? [ma, mb] : null;

  let mine: Record<number, { status: string; score: number | null }> = {};
  let friends: Record<number, { avg: number | null; count: number; completed: number }> = {};
  if (both && userId) {
    const following = (await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } })).map((f) => f.followingId);
    const [own, theirs] = await Promise.all([
      prisma.listEntry.findMany({ where: { userId, anilistId: { in: both.map((m) => m.id) } } }),
      following.length ? prisma.listEntry.findMany({ where: { userId: { in: following }, anilistId: { in: both.map((m) => m.id) }, user: { profilePublic: true } } }) : [],
    ]);
    mine = Object.fromEntries(own.map((e) => [e.anilistId, { status: e.status, score: e.score }]));
    friends = Object.fromEntries(
      both.map((m) => {
        const rows = theirs.filter((e) => e.anilistId === m.id);
        const scored = rows.filter((e) => e.score !== null);
        return [m.id, { avg: scored.length ? scored.reduce((n, e) => n + (e.score ?? 0), 0) / scored.length : null, count: rows.length, completed: rows.filter((e) => e.status === "COMPLETED").length }];
      }),
    );
  }

  const rows: { label: string; values: (m: MediaDetail) => React.ReactNode; better?: (a: MediaDetail, b: MediaDetail) => 0 | 1 | -1 }[] = [
    {
      label: "Score",
      values: (m) => (m.averageScore ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-star text-star" />{(m.averageScore / 10).toFixed(1)}</span> : "—"),
      better: (a, b) => (a.averageScore ?? 0) === (b.averageScore ?? 0) ? 0 : (a.averageScore ?? 0) > (b.averageScore ?? 0) ? -1 : 1,
    },
    { label: "Popularity", values: (m) => m.popularity?.toLocaleString() ?? "—", better: (a, b) => ((a.popularity ?? 0) === (b.popularity ?? 0) ? 0 : (a.popularity ?? 0) > (b.popularity ?? 0) ? -1 : 1) },
    { label: "Format", values: (m) => prettyEnum(m.format) || "—" },
    { label: "Episodes", values: (m) => m.episodes ?? (m.nextAiringEpisode ? `${m.nextAiringEpisode.episode - 1}+` : "—") },
    { label: "Episode length", values: (m) => (m.duration ? `${m.duration} min` : "—") },
    { label: "Total runtime", values: (m) => runtime(m) ?? "—" },
    { label: "Status", values: (m) => prettyEnum(m.status) || "—" },
    { label: "Aired", values: (m) => (m.season ? `${prettyEnum(m.season)} ${m.seasonYear ?? ""}` : m.startDate.year ?? "—") },
    { label: "Studio", values: (m) => m.studios.nodes.map((s) => s.name).join(", ") || "—" },
    { label: "Source", values: (m) => prettyEnum(m.source) || "—" },
    { label: "Genres", values: (m) => <span className="flex flex-wrap justify-center gap-1">{m.genres.map((g) => <span key={g} className="chip !py-0 !text-[10px]">{g}</span>)}</span> },
    ...(userId
      ? [
          { label: "Your list", values: (m: MediaDetail) => (mine[m.id] && isStatus(mine[m.id].status) ? STATUS_LABEL[mine[m.id].status as keyof typeof STATUS_LABEL] : "—") },
          { label: "Your score", values: (m: MediaDetail) => (mine[m.id]?.score ? `${mine[m.id].score}/10` : "—") },
          {
            label: "Friends",
            values: (m: MediaDetail) => {
              const f = friends[m.id];
              if (!f || !f.count) return "—";
              return `${f.avg ? `${f.avg.toFixed(1)}/10 · ` : ""}${f.completed} finished`;
            },
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-[1000px] px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Compare</h1>
      <p className="mt-1.5 text-sm text-muted">Two shows, side by side.</p>
      <div className="mt-6">
        <ComparePicker a={ma ? { id: ma.id, title: title(ma.title), cover: ma.coverImage.large } : null} b={mb ? { id: mb.id, title: title(mb.title), cover: mb.coverImage.large } : null} />
      </div>

      {both ? (
        <div className="panel mt-8 overflow-hidden rounded-2xl">
          <div className="grid grid-cols-[1fr_120px_1fr] items-end gap-4 border-b border-white/[0.06] p-5 sm:grid-cols-[1fr_160px_1fr]">
            {both.map((m, i) => (
              <Link key={m.id} href={`/anime/${m.id}`} className={`group flex flex-col items-center text-center ${i === 1 ? "col-start-3" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.coverImage.large} alt="" className="w-24 rounded-xl object-cover ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-[1.03] sm:w-32" />
                <span className="mt-3 line-clamp-2 text-sm font-medium group-hover:underline">{title(m.title)}</span>
              </Link>
            ))}
          </div>
          <dl>
            {rows.map((r) => {
              const winner = r.better?.(both[0], both[1]) ?? 0;
              return (
                <div key={r.label} className="grid grid-cols-[1fr_120px_1fr] items-center gap-4 border-b border-white/[0.04] px-5 py-3 text-center text-sm last:border-0 sm:grid-cols-[1fr_160px_1fr]">
                  <dd className={winner === -1 ? "font-semibold text-fg" : "text-fg/80"}>{r.values(both[0])}</dd>
                  <dt className="label">{r.label}</dt>
                  <dd className={winner === 1 ? "font-semibold text-fg" : "text-fg/80"}>{r.values(both[1])}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : (
        <p className="mt-16 text-center text-sm text-muted">Pick two shows to compare them.</p>
      )}
    </div>
  );
}
