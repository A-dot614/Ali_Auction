import PageShell from "../../../components/PageShell";
import NotEnabled from "../../../components/NotEnabled";

export const dynamic = "force-dynamic";

export default function StaffDisputesPage() {
  return (
    <PageShell title="Staff dispute review" description="Staff review is not available in this build.">
      <NotEnabled
        message="Not enabled yet"
        detail="Approved dispute outcomes and evidence window are pending. No review data is requested."
      />
    </PageShell>
  );
}
