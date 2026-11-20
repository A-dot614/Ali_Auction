import PageShell from "../../../components/PageShell";
import LegalNoticeContent from "../../../components/LegalNoticeContent";

export const dynamic = "force-dynamic";

export default function DemoAboutPage() {
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
