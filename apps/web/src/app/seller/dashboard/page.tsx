import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "../../../components/PageShell";
import ScreenState from "../../../components/ScreenState";
import Table from "../../../components/ui/Table";
import { gql } from "../../../lib/graphql";
import { stateForFailure } from "../../../lib/error-state";

export const metadata: Metadata = {
  title: "Seller dashboard — AliAuction.ca",
  description: "Seller verification status and recent listing drafts.",
};
export const dynamic = "force-dynamic";

const QUERY = `query {
  mySellerVerification { status }
  myListings(first: 5) { items { id slug title status } }
}`;

export default async function SellerDashboardPage() {
  const result = await gql(QUERY);
  if (result.errors?.length) {
    const failure = stateForFailure(result.errors[0].message);
    return (
      <PageShell title="Seller dashboard" description="Your seller workspace.">
        <ScreenState state={failure.state === "not-enabled" ? "empty" : failure.state} />
      </PageShell>
    );
  }
  const status = result.data?.mySellerVerification?.status;
  const items: any[] = result.data?.myListings?.items ?? [];

  return (
    <PageShell title="Seller dashboard" description="Your seller workspace.">
      <section className="card ui-card">
        <h2>Verification status</h2>
        <p role="status">{status ? String(status) : "No verification record yet."}</p>
        <p><Link href="/seller/onboarding">Set up your seller profile</Link></p>
      </section>
      <section className="card ui-card">
        <h2>Recent listings</h2>
        {items.length === 0 ? (
          <ScreenState state="empty" />
        ) : (
          <Table
            headings={["Title", "Status"]}
            rows={items.map((item) => [
              <Link key={`link-${item.id}`} href={`/seller/listings/${encodeURIComponent(String(item.id))}/edit`}>{String(item.title)}</Link>,
              String(item.status),
            ])}
          />
        )}
        <p><Link href="/seller/listings/new">Create a listing draft</Link> · <Link href="/seller/listings">All listings</Link></p>
      </section>
    </PageShell>
  );
}
