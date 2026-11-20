import PageShell from "../../components/PageShell";
import NotEnabled from "../../components/NotEnabled";

export const dynamic = "force-dynamic";

export default function DisputesPage() {
  return (
    <PageShell title="Disputes" description="Dispute creation is not available in this build.">
      <NotEnabled
        message="Not enabled yet"
        detail="Dispute policy and evidence handling are pending. No dispute endpoint is called from this screen."
      />
    </PageShell>
  );
}
