import type { Metadata } from "next";
import { requirePageUserId } from "@/lib/auth";
import { getHistory } from "@/lib/account";
import HistoryView from "@/components/account/HistoryView";

export const metadata: Metadata = { title: "Watch history" };

export default async function HistoryPage() {
  const { shows, events } = await getHistory((await requirePageUserId("/account/history")));
  return <HistoryView shows={shows} events={events} />;
}
