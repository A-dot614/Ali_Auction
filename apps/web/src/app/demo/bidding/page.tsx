import Link from "next/link";
import PageShell from "../../../components/PageShell";
import DemoBidPanel from "../../../components/DemoBidPanel";
import { findDemoListing } from "../../../lib/demo-data";

export const dynamic = "force-dynamic";

export default async function DemoBiddingPage() {
  const listing = findDemoListing("vintage-desk-lamp");
  if (!listing) return null;
  return (
    <PageShell
      title="Demo bidding simulation"
      description="Local mock state only. Live bidding stays OFF and no decision is made."
    >
      <DemoBidPanel
        startingPriceMinor={listing.startingPrice.minorUnits}
        initialBids={listing.bids.map((bid) => ({
          id: bid.id,
          bidderLabel: bid.bidderLabel,
          amountMinor: bid.amount.minorUnits,
        }))}
      />
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
