import { Crown, Shield, ShieldCheck } from "lucide-react";
import type { Role } from "@/lib/roles";

/** Staff colours and icons, shared by badges next to names and the admin tables. */
export const ROLE_STYLE = {
  owner: { Icon: Crown, label: "Owner", text: "text-amber-400", chip: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  admin: { Icon: ShieldCheck, label: "Admin", text: "text-rose-400", chip: "border-rose-400/30 bg-rose-400/10 text-rose-300" },
  moderator: { Icon: Shield, label: "Moderator", text: "text-sky-400", chip: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
} as const;

/**
 * The little crown/shield next to a staff member's name. `label` shows it as a coloured chip
 * with the role written out (used on profiles); otherwise it's just the icon with a tooltip.
 */
export default function RoleIcon({ role, label = false, className = "" }: { role?: Role | null; label?: boolean; className?: string }) {
  if (!role || role === "user") return null;
  const s = ROLE_STYLE[role];
  if (label)
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${s.chip} ${className}`}>
        <s.Icon className="h-3 w-3" aria-hidden /> {s.label}
      </span>
    );
  return (
    <span className={`inline-flex shrink-0 items-center align-[-2px] ${s.text} ${className}`} title={s.label}>
      <s.Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{s.label}</span>
    </span>
  );
}
