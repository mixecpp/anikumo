"use client";

import type { Role } from "@/lib/roles";
import { ROLE_STYLE } from "../RoleIcon";

export function RoleBadge({ role }: { role: Role }) {
  if (role === "user") return null;
  const s = ROLE_STYLE[role];
  return (
    <span className={`chip !py-0 !text-[10px] ${s.chip}`}>
      <s.Icon className="h-3 w-3" /> {role === "moderator" ? "mod" : role}
    </span>
  );
}
