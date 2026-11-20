import PageShell from "../../../components/PageShell";
import LegalNoticeContent from "../../../components/LegalNoticeContent";

export const dynamic = "force-dynamic";

export default function DemoHelpPage() {
  return (
    <PageShell title="Help" description="Where help information will appear.">
      <LegalNoticeContent
        topics={[
          "Account and verification help",
          "Browsing and orders help",
          "Support contact route",
        ]}
      />
    </PageShell>
  );
}
