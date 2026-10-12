import { CalendarDays, Compass, FolderOpen, House, LayoutGrid, Newspaper, Trophy, UserRound } from "lucide-react";
import type { NavKey } from "@/lib/nav";

const ICONS = { home: House, browse: Compass, season: LayoutGrid, schedule: CalendarDays, charts: Trophy, feed: Newspaper, library: FolderOpen, profile: UserRound };

export default function NavIcon({ name, className, strokeWidth }: { name: NavKey; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />;
}
