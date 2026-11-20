import type { Metadata } from "next";
import PageShell from "../../components/PageShell";
import LegalNoticeContent from "../../components/LegalNoticeContent";

export const metadata: Metadata = {
  title: "About — AliAuction.ca",
  description: "About this Phase 1 build.",
};
export const dynamic = "force-static";

export default function About() {
  return (
    <PageShell title="About" description="About this Phase 1 build.">
      <LegalNoticeContent
        topics={[
          "What AliAuction.ca is",
          "Scope of this build",
          "Which rules remain open",
        ]}
      />
    </PageShell>
  );
}
