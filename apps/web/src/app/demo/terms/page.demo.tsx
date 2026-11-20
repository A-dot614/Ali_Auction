import PageShell from "../../../components/PageShell";
import LegalNoticeContent from "../../../components/LegalNoticeContent";

export const dynamic = "force-dynamic";

export default function DemoTermsPage() {
  return (
    <PageShell title="Terms" description="Draft placeholder for terms.">
      <LegalNoticeContent
        topics={[
          "Terms of use",
          "Auction rules",
          "Fee disclosure",
        ]}
      />
    </PageShell>
  );
}
