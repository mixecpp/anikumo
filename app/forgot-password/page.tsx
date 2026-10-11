import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";

import { ForgotForm } from "@/components/auth/PasswordFlows";

export const metadata: Metadata = { title: "Reset password", ...PRIVATE };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
