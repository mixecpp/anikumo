import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { DeleteContent, ReportActions } from "@/components/admin/AdminActions";

export const metadata: Metadata = { title: "Moderation · Admin" };

function hrefFor(c: { anilistId: number; episode?: number | null }) {
  return c.episode ? `/watch/${c.anilistId}/${c.episode}` : `/anime/${c.anilistId}`;
}

export default async function ModerationPage() {
  await requireAdminPage();
  const [reports, recentComments, recentReviews] = await Promise.all([
    prisma.report.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 50, include: { reporter: { select: { username: true } } } }),
    prisma.comment.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { username: true } } } }),
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { username: true } } } }),
  ]);
  const commentIds = reports.filter((r) => r.targetType === "comment").map((r) => r.targetId);
  const reviewIds = reports.filter((r) => r.targetType === "review").map((r) => r.targetId);
  const [cs, rs] = await Promise.all([
    prisma.comment.findMany({ where: { id: { in: commentIds } }, include: { user: { select: { username: true } } } }),
    prisma.review.findMany({ where: { id: { in: reviewIds } }, include: { user: { select: { username: true } } } }),
  ]);
  const content = new Map<string, { body: string; author: string; href: string }>([
    ...cs.map((c) => [c.id, { body: c.body, author: c.user.username, href: `${hrefFor(c)}#comment-${c.id}` }] as const),
    ...rs.map((r) => [r.id, { body: r.body, author: r.user.username, href: `/anime/${r.anilistId}` }] as const),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-sm font-medium">
          Open reports <span className="font-mono text-[11px] text-muted">{reports.length}</span>
        </h2>
        {reports.length === 0 ? (
          <p className="panel rounded-xl p-6 text-center text-sm text-muted">Nothing to review. Nice.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const c = content.get(r.targetId);
              return (
                <li key={r.id} className="panel rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="chip !py-0">{r.targetType}</span>
                    <span>reported by {r.reporter.username}</span>
                    <span className="font-mono">{r.createdAt.toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="text-muted">Reason:</span> {r.reason || "—"}
                  </p>
                  {c ? (
                    <div className="mt-2 rounded-lg bg-white/[0.03] p-3">
                      <p className="whitespace-pre-wrap break-words text-sm text-fg/80">{c.body}</p>
                      <p className="mt-1 text-xs text-muted">
                        by {c.author} · <Link href={c.href} className="underline">view in context</Link>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Content already deleted.</p>
                  )}
                  <div className="mt-3">
                    <ReportActions reportId={r.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-medium">Latest comments</h2>
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
            {recentComments.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-fg">{c.user.username}</span>
                  <span className="font-mono">{c.createdAt.toLocaleString()}</span>
                  <Link href={`${hrefFor(c)}#comment-${c.id}`} className="hover:text-fg">
                    #{c.anilistId}
                    {c.episode ? ` ep ${c.episode}` : ""}
                  </Link>
                  <span className="ml-auto">
                    <DeleteContent kind="comment" id={c.id} />
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-fg/80">{c.body}</p>
              </li>
            ))}
            {recentComments.length === 0 && <li className="p-6 text-center text-sm text-muted">No comments yet.</li>}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium">Latest reviews</h2>
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
            {recentReviews.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-fg">{r.user.username}</span>
                  <span className="font-mono">{r.score}/10</span>
                  <Link href={`/anime/${r.anilistId}`} className="hover:text-fg">
                    #{r.anilistId}
                  </Link>
                  <span className="ml-auto">
                    <DeleteContent kind="review" id={r.id} />
                  </span>
                </div>
                {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
                <p className="mt-0.5 line-clamp-3 break-words text-sm text-fg/80">{r.body}</p>
              </li>
            ))}
            {recentReviews.length === 0 && <li className="p-6 text-center text-sm text-muted">No reviews yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
