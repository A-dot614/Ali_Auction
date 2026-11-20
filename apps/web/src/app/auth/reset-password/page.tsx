import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose a new password — AliAuction.ca", description: "Set a new password with a reset token." };

export default function ResetPasswordPage() {
  return (
    <PageShell title="Choose a new password" description="Enter your reset token and new password.">
      <AuthForm kind="reset-password" />
    </PageShell>
  );
}
