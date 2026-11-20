import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify email — AliAuction.ca", description: "Verify your email address." };

export default function VerifyEmailPage() {
  return (
    <PageShell title="Verify email" description="Enter the token from your email.">
      <AuthForm kind="verify-email" />
    </PageShell>
  );
}
