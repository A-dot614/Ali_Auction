import type { Metadata } from "next";
import PageShell from "../../components/PageShell";
import LegalNoticeContent from "../../components/LegalNoticeContent";

export const metadata: Metadata = {
  title: "Contact — AliAuction.ca",
  description: "Contact details are not published in this build.",
};
export const dynamic = "force-static";

export default function Contact() {
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
