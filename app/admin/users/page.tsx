import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import UsersTable from "@/components/admin/UsersTable";

export const metadata: Metadata = { title: "Users · Admin" };

export default async function AdminUsersPage() {
  const admin = await requireAdminPage();
  return <UsersTable meId={admin.id} />;
}
