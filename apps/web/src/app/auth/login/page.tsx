import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in — AliAuction.ca", description: "Sign in to your AliAuction.ca account." };

export default function LoginPage() {
  return (
    <PageShell title="Sign in" description="Access your account.">
      <AuthForm kind="login" />
    </PageShell>
  );
}
