import PageShell from "../../../components/PageShell";
import LegalNoticeContent from "../../../components/LegalNoticeContent";

export const dynamic = "force-dynamic";

export default function DemoContactPage() {
  return (
    <PageShell title="Contact" description="Contact details are not published in this build.">
      <LegalNoticeContent
        topics={[
          "General enquiries",
          "Support enquiries",
          "Privacy enquiries",
        ]}
      />
    </PageShell>
  );
}
