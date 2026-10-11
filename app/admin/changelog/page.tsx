import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import ChangelogList from "@/components/ChangelogList";
import { ChangelogForm, DeleteChangelog } from "@/components/admin/AdminActions";

export const metadata: Metadata = { title: "Changelog · Admin" };

export default async function AdminChangelogPage() {
  await requireAdminPage();
  const entries = await prisma.changelogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h2 className="mb-3 text-sm font-medium">Post an update</h2>
        <ChangelogForm />
        <p className="mt-3 text-xs text-muted">
          Shows on <Link href="/changelog" className="underline">/changelog</Link>, and puts a dot on everyone&apos;s account menu until they read it.
        </p>
      </div>
      <div>
        <h2 className="mb-5 text-sm font-medium">
          Published <span className="font-mono text-[11px] text-muted">{entries.length}</span>
        </h2>
        {entries.length ? <ChangelogList entries={entries} actions={(id) => <DeleteChangelog id={id} />} /> : <p className="text-sm text-muted">Nothing yet.</p>}
      </div>
    </div>
  );
}
