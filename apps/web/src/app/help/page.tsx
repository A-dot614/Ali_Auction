import type { Metadata } from "next";
import PageShell from "../../components/PageShell";
import LegalNoticeContent from "../../components/LegalNoticeContent";

export const metadata: Metadata = {
  title: "Help — AliAuction.ca",
  description: "Where help information will appear.",
};
export const dynamic = "force-static";

export default function Help() {
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
