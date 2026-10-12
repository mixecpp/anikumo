import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";

import AuthForm from "@/components/AuthForm";
import { getUserId } from "@/lib/auth";
import { authCovers } from "@/lib/auth-covers";
import { captchaSiteKey } from "@/lib/captcha";

export const metadata: Metadata = { title: "Create account", ...PRIVATE };

export default async function RegisterPage() {
  if (await getUserId()) redirect("/");
  return (
    <Suspense>
      <AuthForm mode="register" covers={await authCovers()} captchaKey={captchaSiteKey()} />
    </Suspense>
  );
}
