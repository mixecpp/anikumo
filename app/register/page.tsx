import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { getUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getUserId()) redirect("/");
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
