import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import ChangelogList from "@/components/ChangelogList";
import { MarkChangelogSeen } from "@/components/WhatsNew";

export const metadata: Metadata = { title: "What's new", description: "New features, improvements and fixes on AniKumo." };
export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
  const entries = await prisma.changelogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="mx-auto max-w-[760px] px-4 pt-12 md:px-8">
      <MarkChangelogSeen latest={entries[0]?.createdAt.toISOString() ?? null} />
      <h1 className="text-3xl font-semibold tracking-tight">What&apos;s new</h1>
      <p className="mt-1.5 text-sm text-muted">New features, improvements and fixes on AniKumo.</p>
      <div className="mt-10">{entries.length ? <ChangelogList entries={entries} /> : <p className="text-sm text-muted">No updates posted yet.</p>}</div>
    </div>
  );
}
