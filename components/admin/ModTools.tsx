"use client";

import { Crown, Shield, ShieldCheck } from "lucide-react";
import type { Role } from "@/lib/roles";

export function RoleBadge({ role }: { role: Role }) {
  if (role === "user") return null;
  const Icon = role === "owner" ? Crown : role === "admin" ? ShieldCheck : Shield;
  return (
    <span className={`chip !py-0 !text-[10px] ${role === "owner" ? "!border-amber-300/30 text-amber-200" : role === "moderator" ? "!border-sky-300/25 text-sky-200" : ""}`}>
      <Icon className="h-3 w-3" /> {role === "moderator" ? "mod" : role}
    </span>
  );
}
