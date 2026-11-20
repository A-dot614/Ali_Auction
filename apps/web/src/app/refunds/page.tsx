import type { Metadata } from "next";
import PageShell from "../../components/PageShell";
import LegalNoticeContent from "../../components/LegalNoticeContent";

export const metadata: Metadata = {
  title: "Refunds — AliAuction.ca",
  description: "Draft placeholder for the refund policy.",
};
export const dynamic = "force-static";

export default function Refunds() {
  return (
    <PageShell title="Refunds" description="Draft placeholder for the refund policy.">
      <LegalNoticeContent
        topics={[
          "Refund policy",
          "Cancellation rules",
          "Dispute-related outcomes",
        ]}
      />
    </PageShell>
  );
}
