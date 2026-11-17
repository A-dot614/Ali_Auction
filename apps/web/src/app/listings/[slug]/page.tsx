import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import AuctionPanel from "../../../components/AuctionPanel";
import { gql } from "../../../lib/graphql";
import { errorCode } from "../../../lib/errors";
import { isPermissionDenied } from "../../../lib/states";

// Data-driven page: resolved at request time so no API fetch happens at build.
export const dynamic = "force-dynamic";

type Data = {
  listing: { slug: string; title: string; description: string } | null;
  auctionForListing: {
    id: string;
    endsAt: string;
    currentPrice: { minorUnits: number };
    bids: { items: Array<{ id: string; bidderLabel: string; amount: { minorUnits: number } }> };
  } | null;
  serverTime: string;
};

const QUERY = `query($slug: String!) {
  listing(slug: $slug) { slug title description }
  auctionForListing(slug: $slug) {
    id endsAt currentPrice { minorUnits }
    bids(first: 20) { items { id bidderLabel amount { minorUnits } } }
  }
  serverTime
}`;

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data: Data | null = null;
  let failure: string | undefined;
  try {
    const result = await gql<Data>(QUERY, { slug });
    if (result.errors?.length) failure = result.errors[0].message;
    else data = result.data;
  } catch {
    failure = "NETWORK_ERROR";
  }

  if (failure) {
    const code = errorCode(failure) ?? failure;
    return (
      <PageShell title="Listing" description="Listing details.">
        <ScreenState state={isPermissionDenied(code) ? "permission-denied" : "error"} />
      </PageShell>
    );
  }
  if (!data?.listing) {
    return (<PageShell title="Listing" description="Listing details."><ScreenState state="empty" /></PageShell>);
  }
  const auction = data.auctionForListing;
  return (
    <PageShell title={data.listing.title} description={data.listing.description}>
      {auction ? (
        <AuctionPanel
          auctionId={auction.id}
          endsAtIso={auction.endsAt}
          initialServerTimeIso={data.serverTime}
          currentPriceMinor={auction.currentPrice.minorUnits}
          bidCount={auction.bids.items.length}
          bids={auction.bids.items}
        />
      ) : (
        <ScreenState state="empty" />
      )}
    </PageShell>
  );
}
