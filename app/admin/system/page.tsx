import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { getSystemInfo } from "@/lib/admin";
import { ClearErrors } from "@/components/admin/AdminActions";

export const metadata: Metadata = { title: "System · Admin" };

function bytes(n: number | null) {
  if (n === null) return "—";
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export default async function SystemPage() {
  await requireAdminPage();
  const info = getSystemInfo();
  const [errors, audit] = await Promise.all([
    prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { admin: { select: { username: true } } } }),
  ]);
  const passing = info.checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-10">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="panel rounded-xl p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Launch checklist</h2>
            <span className="font-mono text-[11px] text-muted">
              {passing}/{info.checks.length} passing
            </span>
          </div>
          <ul className="mt-3 space-y-3">
            {info.checks.map((c) => (
              <li key={c.label} className="flex gap-3 text-sm">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Passing" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-label="Needs attention" />}
                <div>
                  <div className={c.ok ? "text-fg/80" : ""}>{c.label}</div>
                  {!c.ok && <div className="mt-0.5 text-xs text-muted">{c.hint}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel rounded-xl p-5">
          <h2 className="text-sm font-medium">Server</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {(
              [
                ["Uptime", uptime(info.uptimeSeconds)],
                ["Node", info.node],
                ["Memory (RSS)", `${info.memoryMb.rss} MB`],
                ["Heap used", `${info.memoryMb.heap} MB`],
                ["Database", info.database.provider],
                ["DB size", bytes(info.database.bytes)],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-0.5 font-mono text-[13px]">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 text-xs font-medium text-muted">Recent backups</h3>
          {info.backups.length === 0 ? (
            <p className="mt-2 text-xs text-muted">None yet — run npm run db:backup.</p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted">
              {info.backups.slice(0, 5).map((b) => (
                <li key={b.name} className="flex justify-between gap-3">
                  <span className="truncate">{b.name}</span>
                  <span>{bytes(b.bytes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Audit log</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted">No admin actions yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06] text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                <span className="w-36 shrink-0 font-mono text-[11px] text-muted">{a.createdAt.toLocaleString()}</span>
                <span className="text-muted">{a.admin?.username ?? "deleted admin"}</span>
                <span>{a.action}</span>
                {a.target && <span className="font-medium">{a.target}</span>}
                {a.detail && <span className="text-xs text-muted">— {a.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">
            Recent errors <span className="font-mono text-[11px] text-muted">{errors.length}</span>
          </h2>
          {errors.length > 0 && <ClearErrors />}
        </div>
        {errors.length === 0 ? (
          <p className="text-sm text-muted">No errors logged.</p>
        ) : (
          <ul className="space-y-2">
            {errors.map((e) => (
              <li key={e.id} className="panel rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                  <span className="chip !py-0">{e.source}</span>
                  {e.path && <span>{e.path}</span>}
                  <span>{e.createdAt.toLocaleString()}</span>
                </div>
                <p className="mt-1.5 break-words text-sm text-red-300">{e.message}</p>
                {e.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted">Stack</summary>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-muted">{e.stack}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
