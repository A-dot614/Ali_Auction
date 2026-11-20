import Link from "next/link";
import PageShell from "../../../../components/PageShell";
import ScreenState from "../../../../components/ScreenState";
import { findDemoListing, formatMinor } from "../../../../lib/demo-data";
import { formatCountdown, remainingFromServer } from "../../../../lib/countdown";

export const dynamic = "force-dynamic";

export default async function DemoListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = findDemoListing(slug);
  if (!listing) {
    return (
      <PageShell title="Demo listing" description="Demo listing detail.">
        <ScreenState state="empty" />
        <Link href="/demo">Back to demo hub</Link>
      </PageShell>
    );
  }
  const countdown = formatCountdown(
    remainingFromServer(Date.parse(listing.endsAtIso), listing.serverTimeIso)
  );
  return (
    <PageShell
      title={listing.title}
      description={`Demo listing detail — ${listing.categoryName}, ${listing.condition}.`}
    >
      <section className="card ui-card" aria-labelledby="demo-photos-heading">
        <h2 id="demo-photos-heading">Photos</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <div className="photo-grid">
          {listing.photos.map((label) => (
            <div className="photo-tile" role="img" aria-label={`Demo photo: ${label}`} key={label}>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card ui-card">
        <h2>Seller information</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dl>
          <dt>Seller</dt><dd>{listing.seller.displayName}</dd> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <dt>Province</dt><dd>{listing.seller.provinceCode}</dd> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <dt>Verification</dt><dd>{listing.seller.verificationLabel}</dd> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        </dl>
      </section>
      <section className="card ui-card">
        <h2>Listing summary</h2> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <dl>
          <dt>Starting price</dt><dd>{formatMinor(listing.startingPrice)}</dd> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <dt>Current demo price</dt><dd>{formatMinor(listing.currentPrice)}</dd> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <dt>Bid count</dt><dd>{listing.bidCount}</dd> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
          <dt>Auction timer</dt><dd><span role="timer">{countdown}</span></dd> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        </dl>
        <p className="muted">{listing.description}</p>
      </section>
      <Link href="/demo">Back to demo hub</Link>
    </PageShell>
  );
}
