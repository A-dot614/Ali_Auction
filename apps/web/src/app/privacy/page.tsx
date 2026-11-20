import type { Metadata } from "next";
import PageShell from "../../components/PageShell";
import LegalNoticeContent from "../../components/LegalNoticeContent";

export const metadata: Metadata = {
  title: "Privacy — AliAuction.ca",
  description: "Draft placeholder for the privacy notice.",
};
export const dynamic = "force-static";

export default function Privacy() {
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
