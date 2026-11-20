import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset password — AliAuction.ca", description: "Request a password reset." };

export default function ForgotPasswordPage() {
  return (
    <PageShell title="Reset password" description="Request a password reset.">
      <AuthForm kind="forgot-password" />
    </PageShell>
  );
}
