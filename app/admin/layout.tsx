import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { requireStaffPage } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = PRIVATE;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Moderators get in too, but only see Moderation. Every page checks again: layouts alone don't protect them.
  const staff = await requireStaffPage();
  const modOnly = staff.role === "moderator";
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{modOnly ? "Moderation" : "Admin"}</h1>
      <AdminNav modOnly={modOnly} />
      <div className="pt-8">{children}</div>
    </div>
  );
}
