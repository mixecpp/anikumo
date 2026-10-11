import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth";
import { getList } from "@/lib/list";
import { getSnapshots } from "@/lib/media";
import { newEpisodeMap } from "@/lib/notifications";
import ListView from "@/components/list/ListView";

export const metadata: Metadata = { title: "My list" };

export default async function MyListPage() {
  const userId = (await requirePageUserId("/account/list"));
  const entries = await getList(userId);
  const ids = entries.map((e) => e.anilistId);
  const [snaps, fresh] = await Promise.all([
    getSnapshots(ids),
    newEpisodeMap(userId, entries.filter((e) => e.status === "WATCHING").map((e) => e.anilistId)).catch(() => new Map<number, number>()),
  ]);
  const meta = Object.fromEntries(
    ids.map((id) => {
      const s = snaps.get(id);
      return [id, { total: s?.episodes ?? null, format: s?.format ?? null, year: s?.seasonYear ?? null, newEpisodes: fresh.get(id) ?? 0 }];
    }),
  );
  return <ListView initial={entries} meta={meta} />;
}
