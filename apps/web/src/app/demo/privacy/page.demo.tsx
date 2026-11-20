import PageShell from "../../../components/PageShell";
import LegalNoticeContent from "../../../components/LegalNoticeContent";

export const dynamic = "force-dynamic";

export default function DemoPrivacyPage() {
  return (
    <PageShell title="Privacy" description="Draft placeholder for the privacy notice.">
      <LegalNoticeContent
        topics={[
          "Privacy notice",
          "Data inventory summary",
          "Retention and rights information",
        ]}
      />
    </PageShell>
  );
}
