import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/PasswordFlows";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
