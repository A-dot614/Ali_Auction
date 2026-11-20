import PageShell from "../../../components/PageShell";
import NotEnabled from "../../../components/NotEnabled";

export const dynamic = "force-dynamic";

export default function MyBidsPage() {
  return (
    <PageShell title="My bids" description="Bids you have placed.">
      <NotEnabled
        message="Bidding is not enabled"
        detail="Live bidding stays OFF. No bid endpoint is called from this screen."
      />
    </PageShell>
  );
}
