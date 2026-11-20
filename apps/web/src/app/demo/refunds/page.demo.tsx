import PageShell from "../../../components/PageShell";
import LegalNoticeContent from "../../../components/LegalNoticeContent";

export const dynamic = "force-dynamic";

export default function DemoRefundsPage() {
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
