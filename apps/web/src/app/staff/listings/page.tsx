import type { Metadata } from "next";
import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import ListingReviewActions from "../../../components/ListingReviewActions";
import { gql } from "../../../lib/graphql";
import { stateForFailure } from "../../../lib/error-state";
import { formatMinorUnits } from "../../../lib/money";

export const metadata: Metadata = {
  title: "Listing review queue — AliAuction.ca",
  description: "Staff-only queue of listings waiting for moderation.",
};
export const dynamic = "force-dynamic";

const QUERY = `query {
  pendingListingReviews(first: 100) {
    items { id slug title description condition startingPriceMinor currency createdAt status }
  }
}`;

export default async function StaffListingReviewsPage() {
  const result = await gql(QUERY);
  if (result.errors?.length) {
    const failure = stateForFailure(result.errors[0].message);
    return (
      <PageShell title="Listing review queue" description="Staff-only queue of listings waiting for moderation.">
        <ScreenState state={failure.state === "not-enabled" ? "permission-denied" : failure.state} />
      </PageShell>
    );
  }

  const items: any[] = result.data?.pendingListingReviews?.items ?? [];
  return (
    <PageShell title="Listing review queue" description="Staff-only queue of listings waiting for moderation.">
      <section className="card ui-card">
        <h2>Pending review</h2>
        {items.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <ul className="review-list">
            {items.map((item) => (
              <li key={String(item.id)} className="card ui-card">
                <h3>{String(item.title)}</h3>
                <p className="muted">{String(item.slug)} · {String(item.condition)} · {String(item.createdAt)}</p>
                <p>{String(item.description)}</p>
                <p><strong>{formatMinorUnits(item.startingPriceMinor, item.currency)}</strong></p>
                <ListingReviewActions id={String(item.id)} />
              </li>
            ))}
          </ul>
        )}
        <p className="muted">No outcome is pre-filled. Each action is sent to the API for its own authorization and state checks.</p>
      </section>
    </PageShell>
  );
}
