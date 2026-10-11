import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { requireAdminPage } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = PRIVATE;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage(); // pages check again: layouts alone don't protect them
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <AdminNav />
      <div className="pt-8">{children}</div>
    </div>
  );
}
