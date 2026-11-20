import type { Metadata } from "next";
import PageShell from "../../../components/PageShell";
import NotEnabled from "../../../components/NotEnabled";

export const metadata: Metadata = {
  title: "My bids — AliAuction.ca",
  description: "Bidding and saved-item availability in this build.",
};
export const dynamic = "force-dynamic";

export default function MyBidsPage() {
  return (
    <PageShell title="My bids" description="Bids you have placed.">
      <NotEnabled
        message="Bidding is not enabled"
        detail="Live bidding stays OFF. No bid endpoint is called from this screen."
      />
      <NotEnabled
        message="Not enabled yet"
        detail="Saved items (watchlist) have no endpoint in this build, so no items are shown."
      />
    </PageShell>
  );
}
