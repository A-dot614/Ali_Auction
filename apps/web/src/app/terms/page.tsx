import type { Metadata } from "next";
import PageShell from "../../components/PageShell";
import LegalNoticeContent from "../../components/LegalNoticeContent";

export const metadata: Metadata = {
  title: "Terms — AliAuction.ca",
  description: "Draft placeholder for terms.",
};
export const dynamic = "force-static";

export default function Terms() {
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
