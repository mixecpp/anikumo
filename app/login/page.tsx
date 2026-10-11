import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { getUserId } from "@/lib/auth";
import { authCovers } from "@/lib/auth-covers";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getUserId()) redirect("/");
  return (
    <Suspense>
      <AuthForm mode="login" covers={await authCovers()} />
    </Suspense>
  );
}
