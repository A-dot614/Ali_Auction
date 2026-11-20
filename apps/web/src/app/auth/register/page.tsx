import PageShell from "../../../components/PageShell";
import AuthForm from "../../../components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create account — AliAuction.ca", description: "Create an AliAuction.ca account." };

export default function RegisterPage() {
  return (
    <PageShell title="Create account" description="Create an account to sell and manage your details.">
      <AuthForm kind="register" />
    </PageShell>
  );
}
