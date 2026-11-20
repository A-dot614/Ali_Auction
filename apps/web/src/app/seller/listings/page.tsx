import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import Table from "../../../components/ui/Table";
import { gql } from "../../../lib/graphql";
import { stateForFailure } from "../../../lib/error-state";

export const metadata: Metadata = {
  title: "My listings — AliAuction.ca",
  description: "Your listing drafts and their review status.",
};
export const dynamic = "force-dynamic";

const QUERY = `query { myListings(first: 100) {
  items { id slug title status categoryId description condition fulfilmentOption startingPriceMinor }
} }`;

export default async function MyListingsPage() {
  const result = await gql(QUERY);
  if (result.errors?.length) {
    const failure = stateForFailure(result.errors[0].message);
    return (
      <PageShell title="My listings" description="Your listing drafts and their review status.">
        <ScreenState state={failure.state === "not-enabled" ? "empty" : failure.state} />
      </PageShell>
    );
  }
  const items: any[] = result.data?.myListings?.items ?? [];

  return (
    <PageShell title="My listings" description="Your listing drafts and their review status.">
      <section className="card ui-card">
        <h2>Listing status</h2>
        {items.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <Table
            headings={["Title", "Status", "Edit"]}
            rows={items.map((item) => [
              String(item.title),
              String(item.status),
              <Link key={`edit-${item.id}`} href={`/seller/listings/${encodeURIComponent(String(item.id))}/edit`}>Edit</Link>,
            ])}
          />
        )}
        <p><Link href="/seller/listings/new">New listing</Link></p>
      </section>
    </PageShell>
  );
}
