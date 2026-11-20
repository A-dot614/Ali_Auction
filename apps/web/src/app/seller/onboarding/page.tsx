import type { Metadata } from "next";
import PageShell from "../../../components/PageShell";
import SellerProfileForm from "../../../components/SellerProfileForm";

export const metadata: Metadata = {
  title: "Seller onboarding — AliAuction.ca",
  description: "Create a seller profile and submit it for verification.",
};
export const dynamic = "force-dynamic";

export default function SellerOnboardingPage() {
  return (
    <PageShell title="Seller onboarding" description="Verification requirements remain open; no documents are collected.">
      <SellerProfileForm />
    </PageShell>
  );
}
